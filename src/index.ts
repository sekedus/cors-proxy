/**
 * CORS Proxy for Cloudflare Workers
 *
 * A secure CORS proxy with:
 * - Origin-based access control (allowed_site / blacklist_site)
 * - Target URL allow-listing (allowed_target)
 * - Request header removal (remove_headers)
 * - Required client headers (require_header)
 * - Header override via request header (x-corsproxy-headers) and query params (reqHeaders, resHeaders)
 * - Dev mode to bypass all restrictions
 * - Homepage with rendered README
 */

import { getConfig, type ProxyConfig } from './config';
import {
	CORS_HEADERS,
	extractHostname,
	getRequestOrigin,
	isInList,
	parseHeaderOverrideHeader,
	parseHeaderQueryParams,
} from './utils';
import { renderHomepage } from './pages/home';
import { renderTestPage } from './pages/test';
import { renderPlaygroundPage } from './pages/playground';

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const config = getConfig(env);
		const url = new URL(request.url);
		// Dev mode activation:
		//   DEV_PARAM set & DEV_VALUE set   → ?dev=secret          				(exact match)
		//   DEV_PARAM set & DEV_VALUE unset  → ?dev={any non-null value} or ?dev   (param present)
		//   DEV_PARAM unset                  → always production
		const isDev = config.devParam !== ''
			&& (config.devValue !== ''
				? url.searchParams.get(config.devParam) === config.devValue
				: url.searchParams.get(config.devParam) !== null);

		// ----- Homepage -----
		if (url.pathname === '/' || url.pathname === '') {
			return renderHomepage();
		}

		// ----- Test page -----
		if (url.pathname === '/test') {
			return renderTestPage(config, isDev);
		}

		// ----- Playground -----
		if (url.pathname === '/playground') {
			return renderPlaygroundPage(config, isDev);
		}

		// ----- CORS Preflight -----
		if (request.method === 'OPTIONS') {
			return handlePreflight(request, config, isDev);
		}

		// ----- Proxy Request -----
		return handleProxyRequest(request, config, isDev);
	},
} satisfies ExportedHandler<Env>;

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Applies same origin/target restrictions as the proxy handler.
 */
export function handlePreflight(request: Request, config: ProxyConfig, isDev: boolean): Response {
	const origin = getRequestOrigin(request);

	// Access control (same as the proxy handler)
	if (!isDev) {
		// allowed_site / blacklist_site checks
		if (origin) {
			const originHost = extractHostname(origin);
			if (originHost) {
				if (config.allowedSite.length > 0 && !isInList(config.allowedSite, originHost)) {
					return new Response(null, { status: 204 });
				}
				if (isInList(config.blacklistSite, originHost)) {
					return new Response(null, { status: 204 });
				}
			}
		}
	}

	// Build CORS headers for preflight
	const headers = new Headers();

	if (isDev) {
		// Dev mode: allow any origin
		headers.set('Access-Control-Allow-Origin', '*');
	} else if (origin) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.append('Vary', 'Origin');
	} else {
		headers.set('Access-Control-Allow-Origin', '*');
	}

	headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
	headers.set('Access-Control-Max-Age', CORS_HEADERS['Access-Control-Max-Age']);

	const reqHeaders = request.headers.get('Access-Control-Request-Headers');
	if (reqHeaders) {
		headers.set('Access-Control-Allow-Headers', reqHeaders);
	} else {
		headers.set('Access-Control-Allow-Headers', '*');
	}

	return new Response(null, { status: 204, headers });
}

/**
 * Handle the actual proxy request.
 * Supports:
 * - `?url=<target>` (query param, like corsproxy.io)
 * - `/<protocol>/<host>/<path>` (path-based, like cors-anywhere)
 * - Header override via `x-corsproxy-headers` (JSON) or `x-corsproxy-res-headers` (JSON)
 * - Query param override via `reqHeaders` & `resHeaders`
 */
export async function handleProxyRequest(request: Request, config: ProxyConfig, isDev: boolean): Promise<Response> {
	const url = new URL(request.url);

	// ---- Resolve target URL ----
	const targetUrl = resolveTargetUrl(url);
	if (!targetUrl) {
		return new Response(
			JSON.stringify({ error: 'Missing target URL. Use ?url=<target> or /https://example.com' }),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
			},
		);
	}

	let targetHost: string | null;
	try {
		targetHost = new URL(targetUrl).hostname.toLowerCase();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
		});
	}

	// ---- Body size limit ----
	// Check via Content-Length header (fast path)
	let bodyBuffer: ArrayBuffer | null = null;
	if (config.maxBodySize > 0) {
		const contentLength = request.headers.get('Content-Length');
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			if (!isNaN(size) && size > config.maxBodySize) {
				return new Response(JSON.stringify({ error: 'Request body exceeds maximum allowed size' }), {
					status: 413,
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
				});
			}
		} else if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
			// No Content-Length (e.g. Transfer-Encoding: chunked) — read body to verify size
			bodyBuffer = await request.arrayBuffer();
			if (bodyBuffer.byteLength > config.maxBodySize) {
				return new Response(JSON.stringify({ error: 'Request body exceeds maximum allowed size' }), {
					status: 413,
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
				});
			}
		}
	}

	// ---- Access control ----
	if (!isDev) {
		const origin = getRequestOrigin(request);

		// allowed_site: if list is non-empty, origin must be in it
		if (config.allowedSite.length > 0 && origin) {
			const originHost = extractHostname(origin);
			if (!originHost || !isInList(config.allowedSite, originHost)) {
				return new Response(JSON.stringify({ error: 'Origin is not allowed' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
				});
			}
		}

		// blacklist_site: if origin is blacklisted, block
		if (origin) {
			const originHost = extractHostname(origin);
			if (originHost && isInList(config.blacklistSite, originHost)) {
				return new Response(JSON.stringify({ error: 'Origin is blacklisted' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
				});
			}
		}

		// allowed_target: if list is non-empty, target must be in it
		if (config.allowedTarget.length > 0) {
			if (!isInList(config.allowedTarget, targetHost)) {
				return new Response(JSON.stringify({ error: 'Target is not allowed' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
				});
			}
		}

		// require_header: client must include these headers
		if (config.requireHeader.length > 0) {
			for (const header of config.requireHeader) {
				if (!request.headers.get(header)) {
					return new Response(
						JSON.stringify({ error: `Missing required header: ${header}` }),
						{
							status: 400,
							headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
						},
					);
				}
			}
		}
	}

	// ---- Parse header overrides ----
	// From request header (like corsfix's x-corsfix-headers)
	const reqHeadersOverride = parseHeaderOverrideHeader(
		request.headers.get('x-corsproxy-headers'),
	);
	const resHeadersOverride = parseHeaderOverrideHeader(
		request.headers.get('x-corsproxy-res-headers'),
	);

	// From query parameters (like corsproxy.io's reqHeaders & resHeaders)
	const reqHeadersFromQuery = parseHeaderQueryParams(
		url.searchParams.getAll('reqHeaders'),
	);
	const resHeadersFromQuery = parseHeaderQueryParams(
		url.searchParams.getAll('resHeaders'),
	);

	// Merge overrides (header takes precedence over query param)
	const effectiveReqHeaders = { ...reqHeadersFromQuery, ...(reqHeadersOverride ?? {}) };
	const effectiveResHeaders = { ...resHeadersFromQuery, ...(resHeadersOverride ?? {}) };

	// ---- Build the proxied request ----
	// Capture the client's origin for CORS response headers before buildProxyRequest
	// overwrites the outbound Origin header with the target's origin. This prevents
	// triggering CORS on the target side while still reflecting the client's origin
	// in our CORS response.
	const originUrl = getRequestOrigin(request);
	const proxyRequest = buildProxyRequest(request, targetUrl, config, effectiveReqHeaders, bodyBuffer);

	// ---- Fetch the target ----
	let response: Response;
	try {
		response = await fetch(proxyRequest);
	} catch (err) {
		return new Response(
			JSON.stringify({ error: `Failed to fetch target: ${err instanceof Error ? err.message : String(err)}` }),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
			},
		);
	}

	// ---- Build the proxy response ----
	response = new Response(response.body, response);

	// Apply response header overrides
	for (const [header, value] of Object.entries(effectiveResHeaders)) {
		if (value === '') {
			response.headers.delete(header);
		} else {
			response.headers.set(header, value);
		}
	}

	// Set CORS headers
	if (originUrl) {
		response.headers.set('Access-Control-Allow-Origin', originUrl);
		response.headers.append('Vary', 'Origin');
	} else {
		response.headers.set('Access-Control-Allow-Origin', '*');
	}

	response.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
	response.headers.set('Access-Control-Allow-Headers', '*');

	if (isDev) {
		response.headers.set('Access-Control-Allow-Origin', '*');
	}

	return response;
}

/**
 * Resolve the target URL from the request.
 * Supports:
 * - `/<protocol>://<host>/<path>?<query>` (path-based, like cors-anywhere) — path is checked FIRST
 * - `?url=<encoded-target>` (query param) — only used when path has no protocol prefix
 * - `/<host>/<path>` — defaults to https://
 */
export function resolveTargetUrl(url: URL): string | null {
	const path = url.pathname;

	// 1. Path-based with protocol: /http://... or /https://...
	//    Must be checked BEFORE ?url to avoid stealing query params from the target URL.
	if (path.startsWith('/')) {
		const candidate = path.slice(1);
		if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
			try {
				// Reconstruct full target with original query string
				const targetUrl = candidate + url.search;
				new URL(targetUrl); // validate
				return targetUrl;
			} catch {
				return null;
			}
		}
		// 2. Path-based without protocol: treat as https://<path>
		if (candidate.length > 0) {
			// Require a dot, colon (port), or the host to be 'localhost' to avoid
			// treating arbitrary paths (e.g. /not-a-host) as target hostnames.
			if (!candidate.includes('.') && !candidate.includes(':') && candidate !== 'localhost') {
				return null;
			}
			const withProtocol = `https://${candidate}${url.search}`;
			try {
				new URL(withProtocol);
				return withProtocol;
			} catch {
				return null;
			}
		}
	}

	// 3. Fallback: ?url parameter (only if path didn't match)
	const urlParam = url.searchParams.get('url');
	if (urlParam) {
		try {
			const decoded = decodeURIComponent(urlParam);
			new URL(decoded);
			return decoded;
		} catch {
			try {
				new URL(urlParam);
				return urlParam;
			} catch {
				return null;
			}
		}
	}

	return null;
}

/**
 * Build the request to send to the target, applying header removals and overrides.
 */
export function buildProxyRequest(
	originalRequest: Request,
	targetUrl: string,
	config: ProxyConfig,
	reqHeadersOverride: Record<string, string>,
	bodyBuffer?: ArrayBuffer | null,
): Request {
	// Clone the request to make headers mutable
	const hasBody = originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD';
	const requestInit: RequestInit & { duplex?: string } = {
		method: originalRequest.method,
		headers: new Headers(originalRequest.headers),
		body: hasBody ? (bodyBuffer ?? originalRequest.body) : undefined,
		redirect: 'follow',
		// Required by Node.js when body is a ReadableStream, harmless in workerd
		duplex: hasBody ? 'half' : undefined,
	};

	// Remove unwanted headers from the outbound request
	const headers = requestInit.headers as Headers;
	for (const header of config.removeHeaders) {
		headers.delete(header);
	}

	// Apply request header overrides
	for (const [header, value] of Object.entries(reqHeadersOverride)) {
		if (value === '') {
			headers.delete(header);
		} else {
			headers.set(header, value);
		}
	}

	// Set the Origin header to the target's origin to avoid triggering CORS on the target
	try {
		const targetOrigin = new URL(targetUrl).origin;
		headers.set('Origin', targetOrigin);
	} catch {
		// ignore
	}

	// Remove hop-by-hop headers
	const hopByHop = [
		'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
		'te', 'trailers', 'transfer-encoding', 'upgrade',
	];
	for (const h of hopByHop) {
		headers.delete(h);
	}

	return new Request(targetUrl, requestInit);
}

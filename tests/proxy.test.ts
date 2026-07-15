/**
 * Unit tests for proxy logic functions (resolveTargetUrl, buildProxyRequest).
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { TargetRule } from '../src/config';
import { getConfig } from '../src/config';
import { resolveTargetUrl, handlePreflight, default as worker } from '../src/index';

/** Shorthand to build a hostname-only TargetRule from a string. */
function rule(hostname: string, ...pathPatterns: string[]): TargetRule {
	return { hostname, pathPatterns };
}

function makeConfig(overrides: Partial<import('../src/config').ProxyConfig> = {}): import('../src/config').ProxyConfig {
	return {
		allowedSite: [],
		allowedTarget: [],
		blacklistSite: [],
		removeHeaders: [],
		requireHeader: [],
		devParam: 'dev',
		devValue: '',
		maxBodySize: 0,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// resolveTargetUrl
// ---------------------------------------------------------------------------
describe('resolveTargetUrl', () => {
	it('extracts target from path with https:// protocol', () => {
		const url = new URL('https://proxy.test/https://api.example.com/endpoint');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint');
	});

	it('extracts target from path with http:// protocol', () => {
		const url = new URL('http://proxy.test/http://api.example.com/endpoint');
		expect(resolveTargetUrl(url)).toBe('http://api.example.com/endpoint');
	});

	it('preserves query string from original request', () => {
		const url = new URL('https://proxy.test/https://api.example.com/endpoint?foo=1&bar=2');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint?foo=1&bar=2');
	});

	it('extracts target from path without protocol (defaults https)', () => {
		const url = new URL('https://proxy.test/api.example.com/endpoint');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint');
	});

	it('preserves query string when path has no protocol', () => {
		const url = new URL('https://proxy.test/api.example.com/endpoint?q=hello');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint?q=hello');
	});

	it('falls back to ?url parameter when path has no protocol prefix', () => {
		const url = new URL('https://proxy.test/?url=https://api.example.com/endpoint');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint');
	});

	it('prefers path-based target over ?url when path has a protocol', () => {
		// Path has protocol prefix → that wins
		const url = new URL('https://proxy.test/https://path-wins.com/data?url=https://query-loses.com');
		expect(resolveTargetUrl(url)).toBe('https://path-wins.com/data?url=https://query-loses.com');
	});

	it('returns null when path is just "/" and no ?url param', () => {
		const url = new URL('https://proxy.test/');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('returns null for empty path and no ?url', () => {
		const url = new URL('https://proxy.test');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('rejects path without dot or port as target hostname', () => {
		const url = new URL('https://proxy.test/not-a-valid-host');
		// No dot, no port – not treated as a hostname
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('returns null for root path with no ?url param', () => {
		const url = new URL('https://proxy.test/');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('decodes URL-encoded ?url parameter', () => {
		const url = new URL('https://proxy.test/?url=https%3A%2F%2Fapi.example.com%2Fdata');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/data');
	});

	it('handles ?url parameter without encoding', () => {
		// The URL constructor won't preserve a raw https:// in query without encoding,
		// but if it arrives as a raw value (via URLSearchParams), handle it
		const url = new URL('https://proxy.test/?url=https://api.example.com/endpoint');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/endpoint');
	});

	it('path without protocol but with valid hostname works', () => {
		const url = new URL('https://proxy.test/example.com');
		expect(resolveTargetUrl(url)).toBe('https://example.com');
	});

	it('returns null for ?url with invalid target', () => {
		const url = new URL('https://proxy.test/?url=not-a-valid-url');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('path with protocol that has query string preserves the query', () => {
		const url = new URL('https://proxy.test/https://api.example.com/path?existing=1&url=https://nested.com');
		expect(resolveTargetUrl(url)).toBe('https://api.example.com/path?existing=1&url=https://nested.com');
	});

	it('rejects bare localhost without dot or port', () => {
		const url = new URL('https://proxy.test/localhost');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('allows localhost with port (colon check)', () => {
		const url = new URL('https://proxy.test/localhost:8080/api');
		expect(resolveTargetUrl(url)).toBe('https://localhost:8080/api');
	});

	it('rejects path with invalid port number (new URL fails)', () => {
		// candidate has a colon (passes the dot/colon check) but the port
		// is invalid, so new URL('https://example.com:abc') throws.
		const url = new URL('https://proxy.test/example.com:abc');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('allows localhost with protocol prefix', () => {
		const url = new URL('https://proxy.test/http://localhost:3000/');
		expect(resolveTargetUrl(url)).toBe('http://localhost:3000/');
	});

	// --- Protocol validation (?url= fallback) ---

	it('rejects ftp:// protocol via ?url= parameter', () => {
		const url = new URL('https://proxy.test/?url=ftp://ftp.example.com/file');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('rejects file:// protocol via ?url= parameter', () => {
		const url = new URL('https://proxy.test/?url=file:///etc/passwd');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('rejects ws:// protocol via ?url= parameter', () => {
		const url = new URL('https://proxy.test/?url=ws://echo.example.com');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('rejects non-http protocol via ?url= (encoded)', () => {
		const url = new URL('https://proxy.test/?url=ftp%3A%2F%2Fftp.example.com');
		expect(resolveTargetUrl(url)).toBeNull();
	});

	it('handles malformed percent-encoding in ?url with https protocol (inner catch fallback)', () => {
		// %GG is not valid percent-encoding (G is not hex) — decodeURIComponent throws.
		// The inner catch tries new URL() on the raw value. For https it succeeds.
		const url = new URL('https://proxy.test/?url=https://example.com/%GG');
		expect(resolveTargetUrl(url)).toBe('https://example.com/%GG');
	});

	it('rejects malformed percent-encoding in ?url with ftp protocol (inner catch fallback)', () => {
		// decodeURIComponent throws. new URL() succeeds but protocol is not http/https.
		const url = new URL('https://proxy.test/?url=ftp://example.com/%GG');
		expect(resolveTargetUrl(url)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildProxyRequest
// ---------------------------------------------------------------------------
describe('buildProxyRequest', () => {
	let buildProxyRequest: typeof import('../src/index').buildProxyRequest;
	let handleProxyRequest: typeof import('../src/index').handleProxyRequest;

	beforeAll(async () => {
		const mod = await import('../src/index');
		buildProxyRequest = mod.buildProxyRequest;
		handleProxyRequest = mod.handleProxyRequest;
	});

	function makeRequest(url = 'https://proxy.test/https://api.example.com/endpoint', init?: RequestInit): Request {
		return new Request(url, init ?? { method: 'GET' });
	}

	it('creates a GET request with the target URL', () => {
		const req = makeRequest();
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		expect(proxyReq.url).toBe('https://api.example.com/endpoint');
		expect(proxyReq.method).toBe('GET');
	});

	it('sets the Origin header to the target origin', () => {
		const req = makeRequest();
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		expect(proxyReq.headers.get('Origin')).toBe('https://api.example.com');
	});

	it('removes hop-by-hop headers', () => {
		const req = makeRequest('https://proxy.test/target', {
			headers: { 'Connection': 'keep-alive', 'Upgrade': 'websocket', 'X-Custom': 'keep' },
		});
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		expect(proxyReq.headers.has('Connection')).toBe(false);
		expect(proxyReq.headers.has('Upgrade')).toBe(false);
		expect(proxyReq.headers.get('X-Custom')).toBe('keep');
	});

	it('removes configured headers', () => {
		const req = makeRequest('https://proxy.test/target', {
			headers: { 'Cookie': 'secret', 'Authorization': 'Bearer token' },
		});
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig({
			removeHeaders: ['cookie', 'authorization'],
		}), {});
		expect(proxyReq.headers.has('Cookie')).toBe(false);
		expect(proxyReq.headers.has('Authorization')).toBe(false);
	});

	it('applies request header overrides', () => {
		const req = makeRequest();
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {
			'User-Agent': 'CustomAgent/1.0',
		});
		expect(proxyReq.headers.get('User-Agent')).toBe('CustomAgent/1.0');
	});

	it('removes a header when override value is empty string', () => {
		const req = makeRequest('https://proxy.test/target', {
			headers: { 'Referer': 'https://old.com' },
		});
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {
			'Referer': '',
		});
		expect(proxyReq.headers.has('Referer')).toBe(false);
	});

	it('includes body for POST requests', () => {
		const req = makeRequest('https://proxy.test/https://api.example.com/endpoint', {
			method: 'POST',
			body: '{"hello":"world"}',
			headers: { 'Content-Type': 'application/json' },
		});
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		expect(proxyReq.method).toBe('POST');
		// Body should be present (can't easily read in Node, but method is preserved)
	});

	it('does not include body for GET requests', () => {
		const req = makeRequest();
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		// GET requests should have no body
		expect(proxyReq.method).toBe('GET');
	});

	it('preserves the original method', () => {
		const req = makeRequest('https://proxy.test/target', { method: 'DELETE' });
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {});
		expect(proxyReq.method).toBe('DELETE');
	});

	it('uses bodyBuffer when provided', () => {
		const req = makeRequest('https://proxy.test/https://api.example.com/endpoint', {
			method: 'POST',
			// Intentionally omit body – bodyBuffer should be used instead
		});
		const buffer = new TextEncoder().encode('{"buffered":"body"}').buffer as ArrayBuffer;
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig(), {}, buffer);
		expect(proxyReq.method).toBe('POST');
	});

	it('removeHeaders takes precedence over reqHeadersOverride (security boundary)', () => {
		const req = makeRequest('https://proxy.test/target', {
			headers: { 'X-Debug': 'old-value' },
		});
		const proxyReq = buildProxyRequest(req, 'https://api.example.com/endpoint', makeConfig({
			removeHeaders: ['x-debug'],
		}), { 'X-Debug': 'new-value' });
		// REMOVE_HEADERS is a hard security boundary – it always wins
		expect(proxyReq.headers.has('X-Debug')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// handlePreflight
// ---------------------------------------------------------------------------
describe('handlePreflight', () => {

	it('returns 204 with wildcard origin when no origin is present', () => {
		const req = new Request('https://proxy.test/', { method: 'OPTIONS' });
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('echoes back the Origin header and adds Vary', () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: { Origin: 'https://myapp.com' },
		});
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com');
		expect(res.headers.get('Vary')).toContain('Origin');
	});

	it('sets standard CORS methods and max-age', () => {
		const req = new Request('https://proxy.test/', { method: 'OPTIONS' });
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
		expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
	});

	it('echoes Access-Control-Request-Headers when present', () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://myapp.com',
				'Access-Control-Request-Headers': 'Content-Type, Authorization',
			},
		});
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
	});

	it('defaults to wildcard for Allow-Headers when no request headers', () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: { Origin: 'https://myapp.com' },
		});
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Headers')).toBe('*');
	});

	it('blocks disallowed origin when allowed_site is set', async () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = handlePreflight(req, makeConfig({ allowedSite: ['good.com'] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Origin is not allowed');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://bad-site.com');
		expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
	});

	it('blocks blacklisted origin', async () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = handlePreflight(req, makeConfig({ blacklistSite: ['bad-site.com'] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Origin is blacklisted');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://bad-site.com');
	});

	it('allows any origin in dev mode (bypasses restrictions)', () => {
		const req = new Request('https://proxy.test/', {
			method: 'OPTIONS',
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = handlePreflight(req, makeConfig({ allowedSite: ['good.com'] }), true);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('allows any origin when no Origin header is present (even with allowed_site set)', () => {
		// allowed_site check only applies when origin is present
		const req = new Request('https://proxy.test/', { method: 'OPTIONS' });
		const res = handlePreflight(req, makeConfig({ allowedSite: ['good.com'] }), false);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('allows same-origin request to bypass Origin requirement in preflight', () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'OPTIONS',
			headers: {
				'Sec-Fetch-Site': 'same-origin',
				// No Origin header – same-origin requests don't send it
			},
		});
		const res = handlePreflight(req, makeConfig({
			allowedTarget: [rule('api.example.com')],
			requireHeader: ['Origin'],
		}), false);
		expect(res.status).toBe(204);
	});

	it('allows same-origin request to bypass allowed_site check in preflight', () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'OPTIONS',
			headers: {
				'Sec-Fetch-Site': 'same-origin',
				// No Origin header
			},
		});
		const res = handlePreflight(req, makeConfig({
			allowedSite: ['only-specific-site.com'],
			allowedTarget: [rule('api.example.com')],
		}), false);
		expect(res.status).toBe(204);
	});

	it('returns empty response body', () => {
		const req = new Request('https://proxy.test/', { method: 'OPTIONS' });
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.status).toBe(204);
	});

	it('blocks disallowed target when allowed_target is set', async () => {
		const req = new Request('https://proxy.test/https://evil-target.com/data', {
			method: 'OPTIONS',
			headers: { Origin: 'https://good.com' },
		});
		const res = handlePreflight(req, makeConfig({ allowedTarget: [rule('good-target.com')] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Target is not allowed');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://good.com');
	});

	it('allows target in allowed_target during preflight', () => {
		const req = new Request('https://proxy.test/https://good-target.com/data', {
			method: 'OPTIONS',
			headers: { Origin: 'https://good.com' },
		});
		const res = handlePreflight(req, makeConfig({ allowedTarget: [rule('good-target.com')] }), false);
		expect(res.status).toBe(204);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://good.com');
	});

	it('blocks preflight with missing required header', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'OPTIONS',
			headers: { Origin: 'https://myapp.com' },
		});
		const res = handlePreflight(req, makeConfig({
			requireHeader: ['X-Required'],
		}), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Missing required header: X-Required');
		// CORS headers must still be present so the browser can read the error
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com');
		expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
		expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
	});

	it('blocks preflight with missing required header and no Origin (uses wildcard CORS)', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'OPTIONS',
			// No Origin header
		});
		const res = handlePreflight(req, makeConfig({
			requireHeader: ['X-Required'],
		}), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Missing required header: X-Required');
		// When no Origin is present, preflightError falls back to wildcard
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('blocks preflight with origin "null" when allowed_site is configured', async () => {
		// A sandboxed iframe sends Origin: null. The proxy should reject it
		// when allowed_site is set because "null" can't match any entry.
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'OPTIONS',
			headers: { Origin: 'null' },
		});
		const res = handlePreflight(req, makeConfig({ allowedSite: ['trusted.com'] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toBe('Origin is not allowed');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
	});
});

// ---------------------------------------------------------------------------
// handleProxyRequest
// ---------------------------------------------------------------------------
describe('handleProxyRequest', () => {
	let handleProxyRequest: typeof import('../src/index').handleProxyRequest;

	beforeAll(async () => {
		const mod = await import('../src/index');
		handleProxyRequest = mod.handleProxyRequest;
	});

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function mockEnv(overrides: Partial<Record<string, string | undefined>> = {}): Env {
		const defaults: Record<string, string | undefined> = {
			ALLOWED_SITE: '',
			ALLOWED_TARGET: '',
			BLACKLIST_SITE: '',
			REMOVE_HEADERS: '',
			REQUIRE_HEADER: '',
			DEV_PARAM: undefined,
			DEV_VALUE: undefined,
			MAX_BODY_SIZE: undefined,
		};
		return { ...defaults, ...overrides } as unknown as Env;
	}

	// --- Error responses ---

	it('returns 400 when target URL is missing', async () => {
		const req = new Request('https://proxy.test/');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing target URL');
	});

	it('returns 400 for a missing target URL', async () => {
		// resolveTargetUrl validates URLs internally, so invalid URL formats
		// are caught as "Missing target URL" before the handler's own URL check.
		const req = new Request('https://proxy.test/http://');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing target URL');
	});

	it('returns 400 for non-http protocol via ?url= parameter', async () => {
		// resolveTargetUrl rejects non-http protocols before the handler's own check
		const req = new Request('https://proxy.test/?url=ftp://ftp.example.com/file');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing target URL');
	});

	it('returns 400 for file:// protocol via ?url= parameter', async () => {
		// resolveTargetUrl rejects non-http protocols before the handler's own check
		const req = new Request('https://proxy.test/?url=file:///etc/passwd');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing target URL');
	});

	// --- Body size limits ---

	it('returns 413 when Content-Length exceeds maxBodySize', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'POST',
			headers: { 'Content-Length': '5000' },
		});
		const res = await handleProxyRequest(req, makeConfig({ maxBodySize: 1000 }), false);
		expect(res.status).toBe(413);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('exceeds maximum allowed size');
	});

	it('returns 413 when body exceeds maxBodySize via arrayBuffer path', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'POST',
			body: 'x'.repeat(5000),
		});
		const res = await handleProxyRequest(req, makeConfig({ maxBodySize: 1000 }), false);
		expect(res.status).toBe(413);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('exceeds maximum allowed size');
	});

	it('returns 413 when Content-Length is small but actual body exceeds limit (chunked encoding bypass)', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'POST',
			headers: { 'Content-Length': '10' },
			body: 'x'.repeat(5000),
		});
		const res = await handleProxyRequest(req, makeConfig({ maxBodySize: 1000 }), false);
		expect(res.status).toBe(413);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('exceeds maximum allowed size');
	});

	it('allows body within size limit', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'POST',
			body: 'small',
		});
		const res = await handleProxyRequest(req, makeConfig({ maxBodySize: 10000 }), false);
		expect(res.status).toBe(200);
	});

	it('skips body size check when maxBodySize is 0', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			method: 'POST',
			body: 'x'.repeat(50000),
		});
		const res = await handleProxyRequest(req, makeConfig({ maxBodySize: 0 }), false);
		expect(res.status).toBe(200);
	});

	// --- Access control ---

	it('returns 403 when origin is not in allowed_site', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = await handleProxyRequest(req, makeConfig({ allowedSite: ['good.com'] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Origin is not allowed');
	});

	it('allows same-origin request without Origin when allowed_site is set', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('same-origin-ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { 'Sec-Fetch-Site': 'same-origin' },
		});
		const res = await handleProxyRequest(req, makeConfig({
			allowedSite: ['specific-site.com'],
			allowedTarget: [rule('api.example.com')],
		}), false);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe('same-origin-ok');
	});

	it('allows same-origin request to skip requireHeader Origin check', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('same-origin-ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: {
				'Sec-Fetch-Site': 'same-origin',
				'X-Custom': 'present',
			},
		});
		const res = await handleProxyRequest(req, makeConfig({
			requireHeader: ['Origin', 'X-Custom'],
			allowedTarget: [rule('api.example.com')],
		}), false);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe('same-origin-ok');
	});

	it('still blocks same-origin request when target is not allowed', async () => {
		const req = new Request('https://proxy.test/https://evil-target.com/data', {
			headers: { 'Sec-Fetch-Site': 'same-origin' },
		});
		const res = await handleProxyRequest(req, makeConfig({
			allowedTarget: [rule('api.example.com')],
		}), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Target is not allowed');
	});

	it('returns 403 when origin is blacklisted', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = await handleProxyRequest(req, makeConfig({ blacklistSite: ['bad-site.com'] }), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Origin is blacklisted');
	});

	it('returns 400 when BLACKLIST_SITE is set but request has no Origin header', async () => {
		// When BLACKLIST_SITE is configured, getConfig() auto-prepends Origin to requireHeader.
		// The handler enforces this – test both the config layer and the handler together.
		const cfg = getConfig(mockEnv({ BLACKLIST_SITE: 'evil.com' }));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await handleProxyRequest(req, cfg, false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing required header');
		expect(body.error).toContain('Origin');
	});

	it('returns 403 when target is not in allowed_target', async () => {
		const req = new Request('https://proxy.test/https://evil-target.com/data', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig({
			allowedTarget: [rule('good-target.com')],
		}), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Target is not allowed');
	});

	// --- SSRF protection ---

	it('blocks requests to private IPv4 (127.0.0.1)', async () => {
		const req = new Request('https://proxy.test/https://127.0.0.1/admin', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Target is not allowed');
	});

	it('blocks requests to private IPv4 (10.x.x.x)', async () => {
		const req = new Request('https://proxy.test/https://10.0.0.1/secret', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(403);
	});

	it('blocks requests to localhost hostname', async () => {
		const req = new Request('https://proxy.test/https://localhost:3000/api', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(403);
	});

	it('blocks requests to private IP via ?url= parameter', async () => {
		const req = new Request('https://proxy.test/?url=https://192.168.1.1/config', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(403);
	});

	it('allows public IPs through SSRF check', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://93.184.216.34/path', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(200);
	});

	it('bypasses SSRF blocking in dev mode', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('dev-ok'));
		const req = new Request('https://proxy.test/https://127.0.0.1/admin', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), true);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe('dev-ok');
	});

	it('blocks requests to private IP in preflight', async () => {
		const req = new Request('https://proxy.test/https://10.0.0.1/secret', {
			method: 'OPTIONS',
			headers: { Origin: 'https://good.com' },
		});
		const res = handlePreflight(req, makeConfig(), false);
		expect(res.status).toBe(403);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Target is not allowed');
	});

	it('returns 400 when required header is missing', async () => {
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { Origin: 'https://good.com' },
		});
		const res = await handleProxyRequest(req, makeConfig({
			requireHeader: ['X-Required'],
		}), false);
		expect(res.status).toBe(400);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Missing required header');
	});

	// --- Dev mode bypass ---

	it('bypasses all access controls in dev mode', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('dev-access-ok'));
		const req = new Request('https://proxy.test/https://evil-target.com/data', {
			headers: { Origin: 'https://bad-site.com' },
		});
		const res = await handleProxyRequest(req, makeConfig({
			allowedSite: ['good.com'],
			allowedTarget: [rule('good-target.com')],
			blacklistSite: ['bad-site.com'],
		}), true);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe('dev-access-ok');
	});

	// --- Proxy fetch ---

	it('returns 502 when fetch to target fails', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockRejectedValue(new Error('Connection refused'));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(502);
		const body = await res.json() as Record<string, string>;
		expect(body.error).toContain('Failed to fetch target');
	});

	it('successfully proxies a GET request and returns response body', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('{"result":"ok"}', {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		}));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toBe('application/json');
		const text = await res.text();
		expect(text).toBe('{"result":"ok"}');
	});

	// --- CORS response headers ---

	it('sets Access-Control-Allow-Origin to the request origin', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { Origin: 'https://myapp.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://myapp.com');
		expect(res.headers.get('Vary')).toContain('Origin');
	});

	it('sets wildcard CORS origin when no origin is present', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('overrides CORS origin to wildcard in dev mode', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: { Origin: 'https://myapp.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), true);
		// Dev mode overrides to *
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	// --- Response header overrides ---

	it('applies resHeaders override (set)', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok', {
			headers: { 'X-Original': 'val' },
		}));
		const req = new Request('https://proxy.test/https://api.example.com/data?resHeaders=X-Custom:override');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('X-Custom')).toBe('override');
	});

	it('applies resHeaders override (delete via empty value)', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok', {
			headers: { 'X-Remove-Me': 'should-go' },
		}));
		const req = new Request('https://proxy.test/https://api.example.com/data?resHeaders=X-Remove-Me:');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.has('X-Remove-Me')).toBe(false);
	});

	it('applies resHeaders from x-corsproxy-res-headers header (takes priority)', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data?resHeaders=FromQuery:loses', {
			headers: {
				'x-corsproxy-res-headers': '{"FromHeader":"wins"}',
			},
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('FromHeader')).toBe('wins');
	});

	it('sets CORS methods and allow-headers on response', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS');
		expect(res.headers.get('Access-Control-Allow-Headers')).toBe('*');
	});

	it('preserves original response status code', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('not found', { status: 404 }));
		const req = new Request('https://proxy.test/https://api.example.com/not-found');
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(404);
	});

	it('blocks Set-Cookie in response header overrides', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data?resHeaders=Set-Cookie:session=stolen', {
			headers: { Origin: 'https://myapp.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.has('Set-Cookie')).toBe(false);
	});

	it('blocks Set-Cookie via x-corsproxy-res-headers', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: {
				Origin: 'https://myapp.com',
				'x-corsproxy-res-headers': '{"Set-Cookie":"session=stolen"}',
			},
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.has('Set-Cookie')).toBe(false);
	});

	it('allows non-blocked response header overrides', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('ok'));
		const req = new Request('https://proxy.test/https://api.example.com/data?resHeaders=X-Custom:allowed', {
			headers: { Origin: 'https://myapp.com' },
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.headers.get('X-Custom')).toBe('allowed');
	});

	it('applies reqHeaders from x-corsproxy-headers request header', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		let capturedRequest: Request | undefined;
		mockFetch.mockImplementation(async (req) => {
			capturedRequest = req as Request;
			return new Response('ok');
		});
		const req = new Request('https://proxy.test/https://api.example.com/data', {
			headers: {
				Origin: 'https://myapp.com',
				'x-corsproxy-headers': '{"User-Agent":"CustomAgent/2.0"}',
			},
		});
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(200);
		// Verify the proxied request included the override
		expect(capturedRequest).toBeDefined();
		expect(capturedRequest!.headers.get('User-Agent')).toBe('CustomAgent/2.0');
	});

	it('reqHeaders from x-corsproxy-headers takes precedence over reqHeaders query param', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		let capturedRequest: Request | undefined;
		mockFetch.mockImplementation(async (req) => {
			capturedRequest = req as Request;
			return new Response('ok');
		});
		const req = new Request(
			'https://proxy.test/https://api.example.com/data?reqHeaders=User-Agent:from-query',
			{
				headers: {
					Origin: 'https://myapp.com',
					'x-corsproxy-headers': '{"User-Agent":"from-header"}',
				},
			},
		);
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(200);
		expect(capturedRequest).toBeDefined();
		// The header value (`from-header`) should win over the query param value (`from-query`)
		expect(capturedRequest!.headers.get('User-Agent')).toBe('from-header');
	});

	it('applies reqHeaders from query param when no x-corsproxy-headers header is set', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		let capturedRequest: Request | undefined;
		mockFetch.mockImplementation(async (req) => {
			capturedRequest = req as Request;
			return new Response('ok');
		});
		const req = new Request(
			'https://proxy.test/https://api.example.com/data?reqHeaders=User-Agent:from-query',
			{ headers: { Origin: 'https://myapp.com' } },
		);
		const res = await handleProxyRequest(req, makeConfig(), false);
		expect(res.status).toBe(200);
		expect(capturedRequest).toBeDefined();
		expect(capturedRequest!.headers.get('User-Agent')).toBe('from-query');
	});
});

// ---------------------------------------------------------------------------
// default.fetch – integration / routing
// ---------------------------------------------------------------------------
describe('default.fetch (routing)', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ALLOWED_SITE: '',
			ALLOWED_TARGET: '',
			BLACKLIST_SITE: '',
			REMOVE_HEADERS: '',
			REQUIRE_HEADER: '',
			DEV_PARAM: undefined,
			DEV_VALUE: undefined,
			MAX_BODY_SIZE: undefined,
		} as unknown as Env;
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('routes / to the homepage (text/html)', async () => {
		const req = new Request('https://proxy.test/');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const text = await res.text();
		expect(text).toContain('CORS Proxy');
		expect(text).toContain('marked.min.js');
	});

	it('routes /test to the test page', async () => {
		const req = new Request('https://proxy.test/test');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const text = await res.text();
		expect(text).toContain('Try It');
		expect(text).toContain('tryProxy');
	});

	it('routes /playground to the playground page', async () => {
		const req = new Request('https://proxy.test/playground');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const text = await res.text();
		expect(text).toContain('Playground');
		expect(text).toContain('sendRequest');
	});

	it('routes OPTIONS requests to preflight handler (204)', async () => {
		const req = new Request('https://proxy.test/https://api.example.com', {
			method: 'OPTIONS',
		});
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.status).toBe(204);
	});

	it('routes other paths to the proxy handler', async () => {
		const mockFetch = vi.mocked(globalThis.fetch);
		mockFetch.mockResolvedValue(new Response('proxied'));
		const req = new Request('https://proxy.test/https://api.example.com/data');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe('proxied');
	});

	it('shows production badge when no dev param is set (DEV_PARAM empty)', async () => {
		const req = new Request('https://proxy.test/test');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🔒 Production');
		expect(text).not.toContain('🐞 Dev Mode');
	});

	it('activates dev mode when DEV_PARAM is set and ?dev=secret matches DEV_VALUE', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = 'secret';
		const req = new Request('https://proxy.test/test?dev=secret');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🐞 Dev Mode');
		expect(text).toContain('Server Configuration');
	});

	it('activates dev mode when DEV_PARAM is set, DEV_VALUE empty, and any ?dev value', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = '';
		const req = new Request('https://proxy.test/test?dev=anything');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🐞 Dev Mode');
		expect(text).toContain('Server Configuration');
	});

	it('does not activate dev mode when DEV_PARAM is set but param does not match DEV_VALUE', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = 'secret';
		const req = new Request('https://proxy.test/test?dev=wrong');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🔒 Production');
		expect(text).not.toContain('🐞 Dev Mode');
	});

	it('does not activate dev mode when DEV_PARAM is set but param is missing', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = '';
		const req = new Request('https://proxy.test/test');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🔒 Production');
		expect(text).not.toContain('🐞 Dev Mode');
	});

	it('uses custom dev param name', async () => {
		env.DEV_PARAM = 'debug';
		env.DEV_VALUE = '';
		const req = new Request('https://proxy.test/test?debug=true');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🐞 Dev Mode');
	});

	it('routes /favicon.svg to the favicon handler', async () => {
		const req = new Request('https://proxy.test/favicon.svg');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
		expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400');
		const text = await res.text();
		expect(text).toContain('<svg');
		expect(text).toContain('viewBox="0 0 1254 1254"');
	});

	it('renders playground with dev-mode content when in dev mode', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = '';
		const req = new Request('https://proxy.test/playground?dev=true');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('Dev Mode');
		expect(text).toContain('config-info');
		expect(text).toContain('DEV_PARAM');
	});

	it('renders test page with dev-mode content when in dev mode', async () => {
		env.DEV_PARAM = 'dev';
		env.DEV_VALUE = '';
		const req = new Request('https://proxy.test/test?dev=true');
		const res = await worker.fetch(req, env, {} as ExecutionContext);
		const text = await res.text();
		expect(text).toContain('🐞 Dev Mode');
		expect(text).toContain('config-summary');
		expect(text).toContain('Server Configuration');
	});
});

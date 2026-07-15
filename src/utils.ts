/**
 * Utility functions for the CORS proxy.
 */

import { getDomain } from 'tldts';
import type { TargetRule } from './config';

/**
 * Safely parse a JSON-stringified headers object.
 * Returns null if parsing fails.
 */
export function parseHeaderOverrideHeader(value: string | null): Record<string, string> | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, string>;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Parse `reqHeaders` or `resHeaders` query parameters.
 * Format: `reqHeaders=header1:value1&reqHeaders=header2:value2`
 */
export function parseHeaderQueryParams(
	params: string[] | undefined,
): Record<string, string> {
	const result: Record<string, string> = {};
	if (!params) return result;
	for (const param of params) {
		const colonIdx = param.indexOf(':');
		if (colonIdx === -1) continue;
		const header = param.substring(0, colonIdx).trim();
		const value = param.substring(colonIdx + 1).trim();
		if (header) {
			result[header] = value;
		}
	}
	return result;
}

/**
 * Get the origin of the request from the Origin header only.
 * Referer is intentionally not used as a fallback since it can be
 * spoofed via x-corsproxy-headers and is not a reliable indicator
 * of the client's origin for access control decisions.
 */
export function getRequestOrigin(request: Request): string | null {
	const origin = request.headers.get('Origin');
	return origin || null;
}

/**
 * Check if the request is same-origin via the Sec-Fetch-Site header.
 *
 * When a browser sends `Sec-Fetch-Site: same-origin`, it means the requesting
 * page is served from the *exact same origin* as the target – i.e. the request
 * came from one of the proxy's own pages (/, /test, /playground).
 *
 * Sec-Fetch-Site is a forbidden request header – JavaScript cannot set it in
 * fetch() / XMLHttpRequest. It is set only by the browser, so it's a reliable
 * signal of same-origin requests even when the Origin header is absent (which
 * is normal for same-origin GET requests).
 *
 * When this returns true, origin-based access controls (ALLOWED_SITE,
 * BLACKLIST_SITE, and the Origin requirement in REQUIRE_HEADER) can be
 * safely bypassed because the request originates from the proxy itself.
 */
export function isSameOriginRequest(request: Request): boolean {
	const secFetchSite = request.headers.get('Sec-Fetch-Site');
	return secFetchSite?.toLowerCase() === 'same-origin';
}

/**
 * Check if a value is in a list (case-insensitive).
 * Supports wildcard entries with `*.` prefix to match any subdomain.
 * For example, `*.example.com` matches `sub.example.com` but NOT `example.com`.
 * Lowercases both the list items and the value for comparison.
 * Wildcards targeting a public suffix (e.g. "*.com", "*.co.uk") are rejected
 * at config parse time, but this function also includes a runtime safety check.
 */
export function isInList(list: string[], value: string): boolean {
	const lowerVal = value.toLowerCase();
	return list.some((item) => {
		const lowerItem = item.toLowerCase();
		// Wildcard: *.example.com → matches sub.example.com but not example.com
		if (lowerItem.startsWith('*.')) {
			const suffix = lowerItem.slice(1); // ".example.com"
			// Safety: reject if the wildcard targets a public suffix (e.g. ".com", ".co.uk").
			// Strip the leading dot before checking with tldts.
			const domain = suffix.slice(1); // "example.com"
			if (!domain || getDomain(domain) === null) return false;
			return lowerVal.endsWith(suffix) && lowerVal.length > suffix.length;
		}
		return lowerItem === lowerVal;
	});
}

/**
 * Extract the hostname from a URL string.
 */
export function extractHostname(urlStr: string): string | null {
	try {
		const url = new URL(urlStr);
		return url.hostname.toLowerCase();
	} catch {
		return null;
	}
}

/**
 * The default CORS headers applied to all proxy responses.
 */
export const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Max-Age': '86400',
};

/**
 * Content-Security-Policy header shared by all HTML pages.
 */
export const CSP_HEADER = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; font-src 'self' data:;";

// ---------------------------------------------------------------------------
// Target URL allow-listing with wildcard path support
// ---------------------------------------------------------------------------

/**
 * Normalize a URL pathname by resolving `.` and `..` segments.
 *
 * Prevents path-traversal bypasses where an attacker uses `../` to escape
 * the matched path segment while the actual fetch follows the normalized path.
 *
 * Examples:
 *   /a/b/../c  →  /a/c
 *   /a/./b/c   →  /a/b/c
 *   /a/b/c     →  /a/b/c
 */
export function normalizePathname(pathname: string): string {
	const segments = pathname.split('/');
	const result: string[] = [];

	for (const segment of segments) {
		if (segment === '..') {
			if (result.length > 0 && result[result.length - 1] !== '..') {
				result.pop();
			} else {
				result.push('..');
			}
		} else if (segment !== '.' && segment !== '') {
			result.push(segment);
		}
	}

	return '/' + result.join('/');
}

/**
 * Check whether a pathname matches a glob-like pattern.
 *
 * The pattern may contain * which matches any sequence of characters
 * (including /). All other regex metacharacters are escaped so they
 * are treated as literals.
 *
 * Examples:
 *   pattern asterisk/__ia_thumb        matches /download/x/__ia_thumb.jpg
 *   pattern asterisk_page_numbers.json matches /x/foo_page_numbers.json
 */
export function pathnameMatchesPattern(pathname: string, pattern: string): boolean {
	// An empty pattern would match everything – require at least one character.
	if (pattern.length === 0) return false;

	// Escape all regex special characters, then turn * back into .*
	// Use a character-by-character approach to avoid issues with esbuild's regex literal parsing.
	const escaped = pattern.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
		.replace(/\{/g, '\\{')
		.replace(/\}/g, '\\}');
	const regexStr = escaped.replace(/\\\*/g, '.*');

	try {
		// Patterns starting with * are substring matches ("contains").
		// Patterns without a leading * are anchored for an exact path match.
		const re = pattern.startsWith('*')
			? new RegExp(regexStr)
			: new RegExp('^/?(' + regexStr + ')$');
		return re.test(pathname);
	} catch {
		return false;
	}
}

/**
 * Check whether a target URL matches any rule in an allow-list.
 *
 * Each rule is a `TargetRule` with a hostname pattern and optional path
 * patterns. Rules with no path patterns match solely on hostname (legacy
 * behaviour). Rules with path patterns additionally require at least one
 * pattern to match the URL's pathname.
 *
 * If `rules` is empty, all targets are allowed (empty = allow all).
 */
export function isTargetAllowed(targetUrl: string, rules: TargetRule[]): boolean {
	if (rules.length === 0) return true;

	let targetHost: string;
	let targetPathname: string;
	try {
		const url = new URL(targetUrl);
		targetHost = url.hostname.toLowerCase();
		// Decode percent-encoded slashes (%2f / %2F) so that path-traversal
		// sequences like  __ia_thumb%2f..%2f..%2fetc  are properly normalized.
		// The WHATWG URL parser does NOT decode %2f in pathname, which would
		// let an attacker bypass the path-pattern check while the real fetch
		// follows the decoded traversal.
		const decoded = url.pathname.replace(/%2[fF]/g, '/');
		targetPathname = normalizePathname(decoded);
	} catch {
		return false;
	}

	return rules.some((rule) => {
		// 1. Check hostname (supports *. wildcards)
		if (!isInList([rule.hostname], targetHost)) return false;

		// 2. If no path patterns, hostname match is sufficient
		if (rule.pathPatterns.length === 0) return true;

		// 3. Check path patterns – at least one must match
		return rule.pathPatterns.some((pattern) => pathnameMatchesPattern(targetPathname, pattern));
	});
}

// ---------------------------------------------------------------------------
// SSRF protection – private / reserved IP detection
// ---------------------------------------------------------------------------

/**
 * Check whether a hostname is a private or reserved IP address or a known
 * internal hostname.  This is a defence-in-depth measure against SSRF.
 *
 * Based on the OWASP SSRF Prevention Cheat Sheet:
 * https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
 *
 * Checks:
 *   - IPv4 private ranges  (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
 *   - IPv4 loopback        (127.0.0.0/8)
 *   - IPv4 link-local      (169.254.0.0/16)
 *   - IPv4 "this network"  (0.0.0.0/8)
 *   - IPv6 loopback        (::1)
 *   - IPv6 unique local    (fc00::/7)
 *   - IPv6 link-local      (fe80::/10)
 *   - IPv4-mapped IPv6     (::ffff:0:0/96) — recurse on the embedded IPv4
 *   - Well-known internal hostnames (localhost, *.local, *.internal)
 *
 * The hostname should be passed **without** port — use the value from
 * `new URL(url).hostname`.
 */
export function isPrivateHostname(hostname: string): boolean {
	const lower = hostname.toLowerCase();

	// ----- IPv4 checks -----
	const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4Match) {
		const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
		// Each octet must be 0-255 to be a valid IP
		if (octets.some((o) => o < 0 || o > 255)) return false;

		// 10.0.0.0/8
		if (octets[0] === 10) return true;
		// 172.16.0.0/12
		if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
		// 192.168.0.0/16
		if (octets[0] === 192 && octets[1] === 168) return true;
		// 127.0.0.0/8 (loopback)
		if (octets[0] === 127) return true;
		// 169.254.0.0/16 (link-local)
		if (octets[0] === 169 && octets[1] === 254) return true;
		// 0.0.0.0/8  (current network, often used to bind to all interfaces)
		if (octets[0] === 0) return true;

		return false;
	}

	// ----- Known internal hostnames -----
	if (lower === 'localhost' || lower === 'localhost.localdomain') return true;
	if (lower === '[::1]') return true;
	// *.local, *.internal, *.localdomain
	if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localdomain')) return true;

	// ----- IPv6 checks (strip brackets first) -----
	const v6 = lower.replace(/^\[|\]$/g, '');
	if (v6 === '::1') return true;
	// Link-local fe80::/10
	if (v6.startsWith('fe80:')) return true;
	// Unique local fc00::/7 — addresses start with fc or fd in the first hextet
	if (/^f[cd][0-9a-f]{0,3}:/i.test(v6)) return true;
	// IPv4-mapped IPv6 (::ffff:x.x.x.x) — recurse on the embedded IPv4
	if (v6.startsWith('::ffff:')) {
		return isPrivateHostname(v6.slice(7));
	}

	return false;
}

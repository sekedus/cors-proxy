/**
 * Utility functions for the CORS proxy.
 */

import { getDomain } from 'tldts';

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

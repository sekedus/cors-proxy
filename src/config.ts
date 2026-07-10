/**
 * Configuration parsing utilities for the CORS proxy.
 */

import { getDomain } from 'tldts';

export interface ProxyConfig {
	/** Comma-separated list of allowed origins (Origin header). Empty = allow all. */
	allowedSite: string[];
	/** Comma-separated list of allowed target hosts. Empty = allow all. */
	allowedTarget: string[];
	/** Comma-separated list of blacklisted origins. */
	blacklistSite: string[];
	/** Comma-separated list of header names to remove from the outbound request. */
	removeHeaders: string[];
	/** Comma-separated list of header names that must be present on the client request. */
	requireHeader: string[];
	/** Query parameter name that activates dev mode (bypasses restrictions). Defaults to 'dev'. */
	devParam: string;
	/** If set, dev mode is only activated when the dev param value matches this exactly. Empty = any value activates dev mode. */
	devValue: string;
	/** Maximum request body size in bytes before the proxy rejects the request. 0 = no limit. */
	maxBodySize: number;
}

/**
 * Parse a comma-separated list from an environment variable.
 * Returns an array of trimmed, lowercased, non-empty strings.
 */
function parseList(value: string | undefined): string[] {
	if (!value || value.trim() === '') return [];
	return value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Parse a comma-separated list of hostnames.
 * If an entry looks like a URL (contains://), extract just the hostname.
 * This lets users write "https://example.com" instead of just "example.com".
 * Wildcard entries like "*.example.com" are preserved as-is.
 * Wildcards targeting a public suffix (e.g. "*.com", "*.co.uk") are rejected
 * because they would match too many unrelated domains.
 */
function parseHostnames(value: string | undefined): string[] {
	return parseList(value).filter((entry) => {
		if (entry.startsWith('*.')) {
			const suffix = entry.slice(2); // strip "*."
				// Reject if the suffix is a public suffix (e.g. "com", "co.uk", "org").
			// getDomain() returns null for public suffixes and the registrable domain otherwise.
			if (!suffix || getDomain(suffix) === null) {
				return false;
			}
			return true;
		}
		return true;
	}).map((entry) => {
		if (entry.startsWith('*.')) {
			return entry;
		}
		if (entry.includes('://')) {
			try {
				return new URL(entry).hostname;
			} catch {
				return entry;
			}
		}
		return entry;
	});
}

/**
 * Read a plain string value from an environment variable with a default fallback.
 */
function readValue(value: string | undefined, defaultValue: string): string {
	return value && value.trim().length > 0 ? value.trim() : defaultValue;
}

/**
 * Parse a size string like "10MB", "1GB", "500KB" into a byte count.
 * Returns 0 for empty/unset input. Returns 0 silently for unrecognized formats.
 * Allows optional whitespace between the number and unit (e.g. "10 MB").
 */
function parseByteSize(value: string | undefined): number {
	if (!value || value.trim() === '') return 0;
	const s = value.trim().toUpperCase();
	const match = s.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/);
	if (!match) return 0;
	const num = parseFloat(match[1]);
	const unit = match[2] || 'B';
	switch (unit) {
		case 'GB': return num * 1073741824;
		case 'MB': return num * 1048576;
		case 'KB': return num * 1024;
		default: return Math.round(num);
	}
}

/**
 * Build the proxy configuration from environment variables.
 */
export function getConfig(env: Env): ProxyConfig {
	const allowedSite = parseHostnames(env.ALLOWED_SITE);
	const blacklistSite = parseHostnames(env.BLACKLIST_SITE);
	let requireHeader = parseList(env.REQUIRE_HEADER);

	// When ALLOWED_SITE or BLACKLIST_SITE is configured, Origin must be required –
	// otherwise requests without an Origin header would bypass the access control check.
	const needsOrigin = allowedSite.length > 0 || blacklistSite.length > 0;
	if (needsOrigin && !requireHeader.some((h) => h.toLowerCase() === 'origin')) {
		requireHeader = ['Origin', ...requireHeader];
	}

	return {
		allowedSite,
		allowedTarget: parseHostnames(env.ALLOWED_TARGET),
		blacklistSite,
		removeHeaders: parseList(env.REMOVE_HEADERS),
		requireHeader,
		devParam: readValue(env.DEV_PARAM, ''),
		devValue: readValue(env.DEV_VALUE, ''),
		maxBodySize: parseByteSize(env.MAX_BODY_SIZE),
	};
}

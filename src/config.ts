/**
 * Configuration parsing utilities for the CORS proxy.
 */

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
}

/**
 * Parse a comma-separated list from an environment variable.
 * Returns an array of trimmed, lowercased, non-empty strings.
 */
function parseList(value: string | undefined): string[] {
	if (!value || value.trim() === '') return [];
	return value
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter((s) => s.length > 0);
}

/**
 * Build the proxy configuration from environment variables.
 */
export function getConfig(env: Env): ProxyConfig {
	return {
		allowedSite: parseList(env.ALLOWED_SITE),
		allowedTarget: parseList(env.ALLOWED_TARGET),
		blacklistSite: parseList(env.BLACKLIST_SITE),
		removeHeaders: parseList(env.REMOVE_HEADERS),
		requireHeader: parseList(env.REQUIRE_HEADER),
	};
}

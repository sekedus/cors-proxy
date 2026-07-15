/**
 * Unit tests for utility functions (src/utils.ts).
 */

import { describe, it, expect } from 'vitest';
import {
	isPrivateHostname,
	isTargetAllowed,
	isSameOriginRequest,
	isInList,
	normalizePathname,
	parseHeaderOverrideHeader,
	parseHeaderQueryParams,
	pathnameMatchesPattern,
	extractHostname,
	getRequestOrigin,
} from '../src/utils';

// ---------------------------------------------------------------------------
// parseHeaderOverrideHeader
// ---------------------------------------------------------------------------
describe('parseHeaderOverrideHeader', () => {
	it('returns null for null input', () => {
		expect(parseHeaderOverrideHeader(null)).toBeNull();
	});

	it('returns null for undefined-like empty string', () => {
		expect(parseHeaderOverrideHeader('')).toBeNull();
	});

	it('parses a valid JSON object', () => {
		const result = parseHeaderOverrideHeader('{"Origin":"https://example.com"}');
		expect(result).toEqual({ Origin: 'https://example.com' });
	});

	it('returns null for a JSON array', () => {
		expect(parseHeaderOverrideHeader('["a","b"]')).toBeNull();
	});

	it('returns null for a JSON primitive', () => {
		expect(parseHeaderOverrideHeader('"string"')).toBeNull();
		expect(parseHeaderOverrideHeader('123')).toBeNull();
		expect(parseHeaderOverrideHeader('true')).toBeNull();
	});

	it('returns null for malformed JSON', () => {
		expect(parseHeaderOverrideHeader('not-json')).toBeNull();
		expect(parseHeaderOverrideHeader('{broken}')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// parseHeaderQueryParams
// ---------------------------------------------------------------------------
describe('parseHeaderQueryParams', () => {
	it('returns empty object for undefined', () => {
		expect(parseHeaderQueryParams(undefined)).toEqual({});
	});

	it('parses single key:value pair', () => {
		const result = parseHeaderQueryParams(['Accept:application/json']);
		expect(result).toEqual({ Accept: 'application/json' });
	});

	it('parses multiple pairs', () => {
		const result = parseHeaderQueryParams([
			'Accept:application/json',
			'Authorization:Bearer token',
		]);
		expect(result).toEqual({
			Accept: 'application/json',
			Authorization: 'Bearer token',
		});
	});

	it('trims whitespace around header name and value', () => {
		const result = parseHeaderQueryParams(['  Accept  :  application/json  ']);
		expect(result).toEqual({ Accept: 'application/json' });
	});

	it('skips entries without colon separator', () => {
		const result = parseHeaderQueryParams(['Accept:application/json', 'no-colon']);
		expect(result).toEqual({ Accept: 'application/json' });
	});

	it('handles empty value (removal)', () => {
		const result = parseHeaderQueryParams(['X-Debug:']);
		expect(result).toEqual({ 'X-Debug': '' });
	});

	it('handles duplicate keys (last wins)', () => {
		const result = parseHeaderQueryParams(['Key:val1', 'Key:val2']);
		expect(result).toEqual({ Key: 'val2' });
	});
});

// ---------------------------------------------------------------------------
// isInList
// ---------------------------------------------------------------------------
describe('isInList', () => {
	it('returns false for empty list', () => {
		expect(isInList([], 'anything')).toBe(false);
	});

	it('finds exact match', () => {
		expect(isInList(['example.com'], 'example.com')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isInList(['Example.COM'], 'example.com')).toBe(true);
		expect(isInList(['example.com'], 'EXAMPLE.COM')).toBe(true);
	});

	it('returns false for non-matching', () => {
		expect(isInList(['example.com'], 'other.com')).toBe(false);
	});

	it('matches against multiple items', () => {
		expect(isInList(['a.com', 'b.com', 'c.com'], 'b.com')).toBe(true);
		expect(isInList(['a.com', 'b.com', 'c.com'], 'd.com')).toBe(false);
	});

	// --- Wildcard subdomain matching ---

	it('wildcard matches subdomain', () => {
		expect(isInList(['*.example.com'], 'sub.example.com')).toBe(true);
	});

	it('wildcard matches deep subdomain', () => {
		expect(isInList(['*.example.com'], 'deep.sub.example.com')).toBe(true);
	});

	it('wildcard does NOT match the bare domain', () => {
		expect(isInList(['*.example.com'], 'example.com')).toBe(false);
	});

	it('wildcard does NOT match unrelated domain', () => {
		expect(isInList(['*.example.com'], 'other.com')).toBe(false);
	});

	it('wildcard does NOT match partial suffix', () => {
		expect(isInList(['*.example.com'], 'badexample.com')).toBe(false);
	});

	it('wildcard is case-insensitive', () => {
		expect(isInList(['*.Example.COM'], 'sub.example.com')).toBe(true);
		expect(isInList(['*.example.com'], 'SUB.EXAMPLE.COM')).toBe(true);
	});

	it('wildcard works alongside exact entries', () => {
		const list = ['example.com', '*.example.com'];
		expect(isInList(list, 'example.com')).toBe(true);
		expect(isInList(list, 'sub.example.com')).toBe(true);
		expect(isInList(list, 'other.com')).toBe(false);
	});

	it('wildcard with multiple dots works', () => {
		expect(isInList(['*.api.example.com'], 'v1.api.example.com')).toBe(true);
		expect(isInList(['*.api.example.com'], 'api.example.com')).toBe(false);
		expect(isInList(['*.api.example.com'], 'example.com')).toBe(false);
	});

	// --- PSL safety: wildcards targeting public suffixes are rejected ---

	it('rejects wildcard targeting TLD (.com)', () => {
		expect(isInList(['*.com'], 'anything.com')).toBe(false);
	});

	it('rejects wildcard targeting multi-part public suffix (.co.uk)', () => {
		expect(isInList(['*.co.uk'], 'sub.co.uk')).toBe(false);
	});

	it('rejects wildcard targeting bare dot (*.)', () => {
		expect(isInList(['*.'], 'a.')).toBe(false);
	});

	it('allows wildcard targeting registrable domain under public suffix', () => {
		// "myapp.co.uk" is registrable (psl.get("myapp.co.uk") returns "myapp.co.uk")
		expect(isInList(['*.myapp.co.uk'], 'sub.myapp.co.uk')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// extractHostname
// ---------------------------------------------------------------------------
describe('extractHostname', () => {
	it('extracts hostname from full URL', () => {
		expect(extractHostname('https://example.com/path?q=1')).toBe('example.com');
	});

	it('lowercases the hostname', () => {
		expect(extractHostname('HTTP://EXAMPLE.COM')).toBe('example.com');
	});

	it('handles URLs with port', () => {
		expect(extractHostname('https://example.com:8080/path')).toBe('example.com');
	});

	it('returns null for invalid URL', () => {
		expect(extractHostname('not-a-url')).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(extractHostname('')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// isSameOriginRequest
// ---------------------------------------------------------------------------
describe('isSameOriginRequest', () => {
	it('returns true when Sec-Fetch-Site is same-origin', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': 'same-origin' },
		});
		expect(isSameOriginRequest(req)).toBe(true);
	});

	it('returns false when Sec-Fetch-Site is cross-site', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': 'cross-site' },
		});
		expect(isSameOriginRequest(req)).toBe(false);
	});

	it('returns false when Sec-Fetch-Site is same-site', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': 'same-site' },
		});
		expect(isSameOriginRequest(req)).toBe(false);
	});

	it('returns false when Sec-Fetch-Site is none', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': 'none' },
		});
		expect(isSameOriginRequest(req)).toBe(false);
	});

	it('returns false when Sec-Fetch-Site header is absent', () => {
		const req = new Request('https://proxy.test/');
		expect(isSameOriginRequest(req)).toBe(false);
	});

	it('returns false when Sec-Fetch-Site is empty string', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': '' },
		});
		expect(isSameOriginRequest(req)).toBe(false);
	});

	it('is case-insensitive for same-origin', () => {
		const req = new Request('https://proxy.test/', {
			headers: { 'Sec-Fetch-Site': 'SAME-ORIGIN' },
		});
		expect(isSameOriginRequest(req)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getRequestOrigin
// ---------------------------------------------------------------------------
describe('getRequestOrigin', () => {
	it('returns origin from Origin header', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Origin: 'https://example.com' },
		});
		expect(getRequestOrigin(req)).toBe('https://example.com');
	});

	it('returns null when no Origin header is present', () => {
		const req = new Request('https://proxy.test/');
		expect(getRequestOrigin(req)).toBeNull();
	});

	it('returns null for empty Origin header', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Origin: '' },
		});
		expect(getRequestOrigin(req)).toBeNull();
	});

	it('ignores Referer (only Origin header is used)', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Referer: 'https://example.com/page' },
		});
		expect(getRequestOrigin(req)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// normalizePathname
// ---------------------------------------------------------------------------
describe('normalizePathname', () => {

	it('leaves a clean path unchanged', () => {
		expect(normalizePathname('/a/b/c')).toBe('/a/b/c');
	});

	it('resolves single dot segments', () => {
		expect(normalizePathname('/a/./b/c')).toBe('/a/b/c');
	});

	it('resolves double dot segments', () => {
		expect(normalizePathname('/a/b/../c')).toBe('/a/c');
	});

	it('resolves multiple double dots', () => {
		expect(normalizePathname('/a/b/../../c')).toBe('/c');
	});

	it('collapses double slashes', () => {
		expect(normalizePathname('//a//b')).toBe('/a/b');
	});

	it('handles trailing slash', () => {
		expect(normalizePathname('/a/b/')).toBe('/a/b');
	});

	it('returns "/" for empty path', () => {
		expect(normalizePathname('')).toBe('/');
	});

	it('pushes ".." when there are more double-dots than segments', () => {
		// result is empty → pushes '..'
		expect(normalizePathname('..')).toBe('/..');
		// result last element is '..' → pushes another '..'
		expect(normalizePathname('/a/../..')).toBe('/..');
	});
});

// ---------------------------------------------------------------------------
// pathnameMatchesPattern
// ---------------------------------------------------------------------------
describe('pathnameMatchesPattern', () => {

	it('matches literal pattern exactly', () => {
		expect(pathnameMatchesPattern('/api/data', 'api/data')).toBe(true);
	});

	it('does not match different literal', () => {
		expect(pathnameMatchesPattern('/api/data', 'api/other')).toBe(false);
	});

	it('anchors pattern without leading * (does not match subdirectory)', () => {
		// Pattern without * is anchored — only matches exact path
		expect(pathnameMatchesPattern('/download/__ia_thumb.jpg', '__ia_thumb.jpg')).toBe(false);
		expect(pathnameMatchesPattern('/__ia_thumb.jpg', '__ia_thumb.jpg')).toBe(true);
	});

	it('anchors patterns with path segments', () => {
		expect(pathnameMatchesPattern('/images/__ia_thumb.jpg', 'images/__ia_thumb.jpg')).toBe(true);
		expect(pathnameMatchesPattern('/other/__ia_thumb.jpg', 'images/__ia_thumb.jpg')).toBe(false);
	});

	it('matches wildcard at start', () => {
		expect(pathnameMatchesPattern('/download/mars/__ia_thumb.jpg', '*/__ia_thumb')).toBe(true);
	});

	it('matches wildcard with _page_numbers.json', () => {
		expect(pathnameMatchesPattern('/download/book/book_page_numbers.json', '*_page_numbers.json')).toBe(true);
	});

	it('matches wildcard with _archive.torrent', () => {
		expect(pathnameMatchesPattern('/download/game/game_archive.torrent', '*_archive.torrent')).toBe(true);
	});

	it('matches pattern with trailing content', () => {
		expect(pathnameMatchesPattern('/path/to/file_archive.torrent?query', '*_archive.torrent')).toBe(true);
	});

	it('does not match when literal part is absent', () => {
		expect(pathnameMatchesPattern('/download/test.txt', '*_page_numbers.json')).toBe(false);
	});

	it('treats * as cross-segment wildcard', () => {
		expect(pathnameMatchesPattern('/a/b/c/d/file.txt', '*/file.txt')).toBe(true);
	});

	it('handles multiple wildcards in pattern', () => {
		expect(pathnameMatchesPattern('/a/b/c/d/file.txt', '*/b/*/file.txt')).toBe(true);
		expect(pathnameMatchesPattern('/a/x/c/d/file.txt', '*/b/*/file.txt')).toBe(false);
	});

	it('returns false for empty pattern', () => {
		expect(pathnameMatchesPattern('/test', '')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isTargetAllowed
// ---------------------------------------------------------------------------
describe('isTargetAllowed', () => {

	it('allows any target when rules are empty', () => {
		expect(isTargetAllowed('https://example.com/path', [])).toBe(true);
	});

	it('matches hostname-only rule', () => {
		const rules = [{ hostname: 'example.com', pathPatterns: [] }];
		expect(isTargetAllowed('https://example.com/path', rules)).toBe(true);
		expect(isTargetAllowed('https://other.com/path', rules)).toBe(false);
	});

	it('matches hostname with path pattern', () => {
		const rules = [
			{ hostname: 'archive.org', pathPatterns: ['*/__ia_thumb'] },
		];
		expect(isTargetAllowed('https://archive.org/download/file/__ia_thumb.jpg', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/file.txt', rules)).toBe(false);
	});

	it('matches multiple path patterns (pipe-separated)', () => {
		const rules = [
			{
				hostname: 'archive.org',
				pathPatterns: ['*/__ia_thumb', '*_page_numbers.json', '*_archive.torrent'],
			},
		];
		expect(isTargetAllowed('https://archive.org/download/x/__ia_thumb.jpg', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/book_page_numbers.json', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/game_archive.torrent', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/other.txt', rules)).toBe(false);
	});

	it('prevents path traversal bypass', () => {
		// Even if the raw pathname contains /../, the normalized path won't match
		const rules = [
			{ hostname: 'archive.org', pathPatterns: ['*/__ia_thumb'] },
		];
		expect(isTargetAllowed('https://archive.org/download/__ia_thumb/../../etc/passwd', rules)).toBe(false);
	});

	it('prevents percent-encoded path traversal bypass (%2f)', () => {
		// %2f is NOT decoded by the WHATWG URL parser, so without explicit
		// handling an attacker could smuggle ../ via  %2f..%2f..%2f
		const rules = [
			{ hostname: 'archive.org', pathPatterns: ['*/__ia_thumb'] },
		];
		// The decoded path  /download/__ia_thumb/../../etc/passwd  normalises
		// to /etc/passwd which does not match */__ia_thumb → blocked
		expect(isTargetAllowed(
			'https://archive.org/download/x/__ia_thumb%2f..%2f..%2fetc%2fpasswd',
			rules,
		)).toBe(false);
		// A path that genuinely contains %2f (not traversal) should still be
		// matched correctly — after decoding, /__ia_thumb/ is still present.
		expect(isTargetAllowed(
			'https://archive.org/download/x/__ia_thumb%2fsubdir%2ffile.txt',
			rules,
		)).toBe(true);
	});

	it('returns false for invalid target URL', () => {
		expect(isTargetAllowed('not-a-url', [{ hostname: 'example.com', pathPatterns: [] }])).toBe(false);
	});

	it('supports *. wildcard in hostname', () => {
		const rules = [{ hostname: '*.archive.org', pathPatterns: ['*/__ia_thumb'] }];
		expect(isTargetAllowed('https://sub.archive.org/download/__ia_thumb.jpg', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/__ia_thumb.jpg', rules)).toBe(false);
	});

	it('anchors pattern without leading * (exact path match)', () => {
		const rules = [
			{ hostname: 'archive.org', pathPatterns: ['__ia_thumb.jpg'] },
		];
		// Exact match at root passes
		expect(isTargetAllowed('https://archive.org/__ia_thumb.jpg', rules)).toBe(true);
		// Subdirectory path fails
		expect(isTargetAllowed('https://archive.org/download/__ia_thumb.jpg', rules)).toBe(false);
	});

	it('matches multiple rules (any rule can allow)', () => {
		const rules = [
			{ hostname: 'example.com', pathPatterns: [] },
			{ hostname: 'archive.org', pathPatterns: ['*/__ia_thumb'] },
		];
		expect(isTargetAllowed('https://example.com/anything', rules)).toBe(true);
		expect(isTargetAllowed('https://archive.org/download/__ia_thumb.jpg', rules)).toBe(true);
		expect(isTargetAllowed('https://other.com/path', rules)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isPrivateHostname
// ---------------------------------------------------------------------------
describe('isPrivateHostname', () => {
	// --- IPv4 private ranges ---
	it('detects 10.0.0.0/8 as private', () => {
		expect(isPrivateHostname('10.0.0.1')).toBe(true);
		expect(isPrivateHostname('10.255.255.255')).toBe(true);
	});

	it('detects 172.16.0.0/12 as private', () => {
		expect(isPrivateHostname('172.16.0.1')).toBe(true);
		expect(isPrivateHostname('172.31.255.255')).toBe(true);
		expect(isPrivateHostname('172.32.0.1')).toBe(false);
	});

	it('detects 192.168.0.0/16 as private', () => {
		expect(isPrivateHostname('192.168.0.1')).toBe(true);
		expect(isPrivateHostname('192.168.255.255')).toBe(true);
		expect(isPrivateHostname('192.169.0.1')).toBe(false);
	});

	it('detects 127.0.0.0/8 (loopback) as private', () => {
		expect(isPrivateHostname('127.0.0.1')).toBe(true);
		expect(isPrivateHostname('127.255.255.255')).toBe(true);
	});

	it('detects 169.254.0.0/16 (link-local) as private', () => {
		expect(isPrivateHostname('169.254.0.1')).toBe(true);
		expect(isPrivateHostname('169.254.255.255')).toBe(true);
		expect(isPrivateHostname('169.255.0.1')).toBe(false);
	});

	it('detects 0.0.0.0/8 as private', () => {
		expect(isPrivateHostname('0.0.0.0')).toBe(true);
		expect(isPrivateHostname('0.255.255.255')).toBe(true);
	});

	// --- Public IPs ---
	it('allows public IPv4 addresses', () => {
		expect(isPrivateHostname('example.com')).toBe(false);
		expect(isPrivateHostname('93.184.216.34')).toBe(false);
		expect(isPrivateHostname('8.8.8.8')).toBe(false);
	});

	// --- Internal hostnames ---
	it('detects localhost as private', () => {
		expect(isPrivateHostname('localhost')).toBe(true);
		expect(isPrivateHostname('localhost.localdomain')).toBe(true);
	});

	it('detects .local / .internal / .localdomain suffixes as private', () => {
		expect(isPrivateHostname('myhost.local')).toBe(true);
		expect(isPrivateHostname('internal.service.internal')).toBe(true);
		expect(isPrivateHostname('server.localdomain')).toBe(true);
		expect(isPrivateHostname('public.com')).toBe(false);
	});

	// --- IPv6 ---
	it('detects IPv6 loopback (::1) as private', () => {
		expect(isPrivateHostname('::1')).toBe(true);
		expect(isPrivateHostname('[::1]')).toBe(true);
	});

	it('detects IPv6 link-local (fe80::/10) as private', () => {
		expect(isPrivateHostname('fe80::1')).toBe(true);
		expect(isPrivateHostname('fe80::abcd:1234')).toBe(true);
	});

	it('detects IPv6 unique local (fc00::/7) as private', () => {
		expect(isPrivateHostname('fc00::1')).toBe(true);
		expect(isPrivateHostname('fd00::1')).toBe(true);
		expect(isPrivateHostname('fd12:3456::1')).toBe(true);
	});

	it('detects IPv4-mapped IPv6 private addresses', () => {
		expect(isPrivateHostname('::ffff:127.0.0.1')).toBe(true);
		expect(isPrivateHostname('::ffff:10.0.0.1')).toBe(true);
		expect(isPrivateHostname('::ffff:8.8.8.8')).toBe(false);
	});

	// --- Invalid IPs ---
	it('returns false for invalid IPv4', () => {
		expect(isPrivateHostname('999.999.999.999')).toBe(false);
		expect(isPrivateHostname('256.0.0.1')).toBe(false);
	});
});

/**
 * Unit tests for utility functions (src/utils.ts).
 */

import { describe, it, expect } from 'vitest';
import {
	parseHeaderOverrideHeader,
	parseHeaderQueryParams,
	isInList,
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

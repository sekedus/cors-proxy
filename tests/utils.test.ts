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

	it('falls back to Referer when no Origin', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Referer: 'https://example.com/page' },
		});
		expect(getRequestOrigin(req)).toBe('https://example.com');
	});

	it('returns null when neither Origin nor Referer are present', () => {
		const req = new Request('https://proxy.test/');
		expect(getRequestOrigin(req)).toBeNull();
	});

	it('returns null when Referer is not a valid URL', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Referer: 'not-a-url' },
		});
		expect(getRequestOrigin(req)).toBeNull();
	});

	it('Origin header takes precedence over Referer', () => {
		const req = new Request('https://proxy.test/', {
			headers: {
				Origin: 'https://origin-wins.com',
				Referer: 'https://referer-loses.com/page',
			},
		});
		expect(getRequestOrigin(req)).toBe('https://origin-wins.com');
	});

	it('returns null for empty Origin header', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Origin: '' },
		});
		expect(getRequestOrigin(req)).toBeNull();
	});

	it('extracts origin from Referer with port', () => {
		const req = new Request('https://proxy.test/', {
			headers: { Referer: 'https://example.com:8080/page' },
		});
		expect(getRequestOrigin(req)).toBe('https://example.com:8080');
	});
});

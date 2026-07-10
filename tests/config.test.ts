/**
 * Unit tests for configuration parsing (src/config.ts).
 */

import { describe, it, expect } from 'vitest';
import { getConfig } from '../src/config';

// Helper to create a mock Env object
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

// ---------------------------------------------------------------------------
// getConfig – integration tests for the full pipeline
// ---------------------------------------------------------------------------
describe('getConfig', () => {
	it('returns default values when no env vars are set', () => {
		const cfg = getConfig(mockEnv());
		expect(cfg.allowedSite).toEqual([]);
		expect(cfg.allowedTarget).toEqual([]);
		expect(cfg.blacklistSite).toEqual([]);
		expect(cfg.removeHeaders).toEqual([]);
		expect(cfg.requireHeader).toEqual([]);
		expect(cfg.devParam).toBe('');
		expect(cfg.devValue).toBe('');
		expect(cfg.maxBodySize).toBe(0);
	});

	it('parses comma-separated lists correctly', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'mysite.com,anotherapp.org',
			ALLOWED_TARGET: 'api.example.com,data.test.com',
			BLACKLIST_SITE: 'bad-site.com',
			REMOVE_HEADERS: 'cookie,authorization',
			REQUIRE_HEADER: 'X-Requested-With',
		}));
		expect(cfg.allowedSite).toEqual(['mysite.com', 'anotherapp.org']);
		expect(cfg.allowedTarget).toEqual(['api.example.com', 'data.test.com']);
		expect(cfg.blacklistSite).toEqual(['bad-site.com']);
		expect(cfg.removeHeaders).toEqual(['cookie', 'authorization']);
		// Origin is auto-prepended because ALLOWED_SITE is non-empty
		expect(cfg.requireHeader).toEqual(['Origin', 'X-Requested-With']);
	});

	it('preserves original casing in list entries', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'MySite.COM,Another.Org',
		}));
		expect(cfg.allowedSite).toEqual(['MySite.COM', 'Another.Org']);
	});

	it('strips whitespace from list entries', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '  mysite.com ,  another.org  ',
		}));
		expect(cfg.allowedSite).toEqual(['mysite.com', 'another.org']);
	});

	it('extracts hostname from URL-like entries in allowedSite/allowedTarget', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'https://app.example.com',
			ALLOWED_TARGET: 'https://api.web.archive.org,http://localhost:8080',
		}));
		expect(cfg.allowedSite).toEqual(['app.example.com']);
		expect(cfg.allowedTarget).toEqual(['api.web.archive.org', 'localhost']);
	});

	it('preserves wildcard prefix in hostname lists', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '*.example.com,example.com',
			ALLOWED_TARGET: '*.api.example.com',
			BLACKLIST_SITE: '*.evil.com',
		}));
		expect(cfg.allowedSite).toEqual(['*.example.com', 'example.com']);
		expect(cfg.allowedTarget).toEqual(['*.api.example.com']);
		expect(cfg.blacklistSite).toEqual(['*.evil.com']);
	});

	it('rejects wildcards targeting a TLD (public suffix)', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '*.com,*.org,*.net',
		}));
		expect(cfg.allowedSite).toEqual([]);
	});

	it('rejects wildcards targeting a multi-part public suffix like co.uk', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '*.co.uk,*.gov.uk',
		}));
		expect(cfg.allowedSite).toEqual([]);
	});

	it('rejects wildcards targeting public suffix but keeps valid wildcards', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '*.com,*.example.com,*.co.uk,*.myapp.co.uk',
		}));
		expect(cfg.allowedSite).toEqual(['*.example.com', '*.myapp.co.uk']);
	});

	it('rejects bare wildcard "*."', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '*.',
		}));
		expect(cfg.allowedSite).toEqual([]);
	});

	it('auto-prepends Origin to requireHeader when ALLOWED_SITE is set', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'mysite.com',
			REQUIRE_HEADER: 'X-Custom',
		}));
		expect(cfg.requireHeader).toEqual(['Origin', 'X-Custom']);
	});

	it('does not duplicate Origin in requireHeader when already present', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'mysite.com',
			REQUIRE_HEADER: 'Origin,X-Custom',
		}));
		expect(cfg.requireHeader).toEqual(['Origin', 'X-Custom']);
	});

	it('auto-prepends Origin to requireHeader when BLACKLIST_SITE is set (even without ALLOWED_SITE)', () => {
		const cfg = getConfig(mockEnv({
			BLACKLIST_SITE: 'evil.com',
			REQUIRE_HEADER: 'X-Custom',
		}));
		expect(cfg.requireHeader).toEqual(['Origin', 'X-Custom']);
	});

	it('does not duplicate Origin when BLACKLIST_SITE and ALLOWED_SITE are both set and Origin already present', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: 'good.com',
			BLACKLIST_SITE: 'evil.com',
			REQUIRE_HEADER: 'Origin,X-Custom',
		}));
		expect(cfg.requireHeader).toEqual(['Origin', 'X-Custom']);
	});

	it('does not auto-prepend Origin when both ALLOWED_SITE and BLACKLIST_SITE are empty', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '',
			BLACKLIST_SITE: '',
			REQUIRE_HEADER: 'X-Custom',
		}));
		expect(cfg.requireHeader).toEqual(['X-Custom']);
	});

	it('handles empty string lists as empty arrays', () => {
		const cfg = getConfig(mockEnv({
			ALLOWED_SITE: '',
			ALLOWED_TARGET: '   ',
		}));
		expect(cfg.allowedSite).toEqual([]);
		expect(cfg.allowedTarget).toEqual([]);
	});

	it('uses custom devParam', () => {
		const cfg = getConfig(mockEnv({ DEV_PARAM: 'secret' }));
		expect(cfg.devParam).toBe('secret');
	});

	it('uses default devParam when env var is empty', () => {
		const cfg = getConfig(mockEnv({ DEV_PARAM: '' }));
		expect(cfg.devParam).toBe('');
	});

	it('reads devValue when set', () => {
		const cfg = getConfig(mockEnv({ DEV_VALUE: 'my-secret' }));
		expect(cfg.devValue).toBe('my-secret');
	});

	it('defaults devValue to empty string', () => {
		const cfg = getConfig(mockEnv());
		expect(cfg.devValue).toBe('');
	});

	// -----------------------------------------------------------------------
	// maxBodySize tests (parseByteSize integration)
	// -----------------------------------------------------------------------
	it('parses maxBodySize as bytes from human-readable strings', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '0' })).maxBodySize).toBe(0);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '500' })).maxBodySize).toBe(500);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1KB' })).maxBodySize).toBe(1024);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '2KB' })).maxBodySize).toBe(2048);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1MB' })).maxBodySize).toBe(1048576);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '10MB' })).maxBodySize).toBe(10485760);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1GB' })).maxBodySize).toBe(1073741824);
	});

	it('defaults maxBodySize to 0 when env var is empty', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '' })).maxBodySize).toBe(0);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '  ' })).maxBodySize).toBe(0);
	});

	it('defaults maxBodySize to 0 for unparseable values', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: 'invalid' })).maxBodySize).toBe(0);
	});

	it('handles decimal byte sizes', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1.5KB' })).maxBodySize).toBe(1536);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '2.5MB' })).maxBodySize).toBe(2621440);
	});

	it('accepts "B" suffix for bytes', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '100B' })).maxBodySize).toBe(100);
	});

	it('is case-insensitive for size units', () => {
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1mb' })).maxBodySize).toBe(1048576);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1Mb' })).maxBodySize).toBe(1048576);
		expect(getConfig(mockEnv({ MAX_BODY_SIZE: '1MB' })).maxBodySize).toBe(1048576);
	});
});

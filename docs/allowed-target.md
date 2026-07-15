# `ALLOWED_TARGET` Configuration Guide

`ALLOWED_TARGET` controls which **hosts** and **paths** the proxy is allowed to forward requests to. When set, any request to a target that doesn't match at least one rule is rejected with `403 Target is not allowed`.

> **If `ALLOWED_TARGET` is empty/unset, all targets are allowed.**  
> Set this variable to lock down your proxy.

---

## Table of Contents

- [Format Overview](#format-overview)
- [Hostname-Only Entries](#hostname-only-entries)
- [Hostname + Path Pattern](#hostname--path-pattern)
- [Where `*` Can Appear](#where--can-appear)
- [Multiple Path Patterns (Pipe Syntax)](#multiple-path-patterns-pipe-syntax)
- [Full URL Format](#full-url-format)
- [Wildcard Subdomain Hostnames](#wildcard-subdomain-hostnames)
- [Mixing Entry Types](#mixing-entry-types)
- [Common Configurations](#common-configurations)
- [Security Notes](#security-notes)

---

## Format Overview

Every entry in `ALLOWED_TARGET` follows one of these patterns:

| Format | Example | What it matches |
|--------|---------|-----------------|
| `hostname` | `jsonplaceholder.typicode.com` | Any path on the host |
| `hostname/pattern` | `archive.org/__ia_thumb.jpg` | Exact path `/__ia_thumb.jpg` on `archive.org` |
| `hostname/pattern/*` | `archive.org/details/*` | Any path under `/details/` on `archive.org` (prefix match) |
| `hostname/*pattern` | `archive.org/*/__ia_thumb` | Any path containing `/__ia_thumb` on `archive.org` |
| `hostname/p1\|p2\|p3` | `archive.org/*/__ia_thumb\|*_page_numbers.json` | Any of the three patterns on `archive.org` |
| `https://hostname/path` | `https://api.example.com/v1/users` | Exact path `/v1/users` on `api.example.com` (URL form) |
| `*.hostname` | `*.example.com` | Any subdomain of `example.com` |

Entries are **comma-separated** in a single environment variable:

```
ALLOWED_TARGET = jsonplaceholder.typicode.com,archive.org/*/__ia_thumb,*.example.com
```

---

## Hostname-Only Entries

The simplest form — just a hostname. Allows **any path** on that host.

```
ALLOWED_TARGET = jsonplaceholder.typicode.com
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.your-subdomain.workers.dev/https://jsonplaceholder.typicode.com/posts/1` | ✅ Allowed |
| `https://cors-proxy.your-subdomain.workers.dev/https://jsonplaceholder.typicode.com/users` | ✅ Allowed |
| `https://cors-proxy.your-subdomain.workers.dev/https://other-api.com/data` | ❌ Blocked |

You can write entries as plain hostnames or full URLs — the proxy extracts the hostname either way:

```
ALLOWED_TARGET = jsonplaceholder.typicode.com,https://jsonplaceholder.typicode.com
```

Both produce the same rule.

---

## Hostname + Path Pattern

Append a path pattern after the hostname with a `/` separator. The hostname must still match, and the pathname must match the pattern.

```
ALLOWED_TARGET = archive.org/__ia_thumb.jpg
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.your-subdomain.workers.dev/https://archive.org/__ia_thumb.jpg` | ✅ Matches exact path |
| `https://cors-proxy.your-subdomain.workers.dev/https://archive.org/download/x/__ia_thumb.jpg` | ❌ Not exact match |
| `https://cors-proxy.your-subdomain.workers.dev/https://other-site.com/__ia_thumb.jpg` | ❌ Hostname mismatch |

---

## Where `*` Can Appear

The `*` character matches **any sequence of characters** (including `/`). Where you place `*` in the pattern changes how the pathname is matched:

| `*` position | Behavior | Example |
|---|---|---|
| **Leading** `*` (`*/__ia_thumb`) | **Substring** — matches if the pathname contains the pattern anywhere | `/download/x/__ia_thumb.jpg` ✅ |
| **Trailing** `*` (`details/*`) | **Prefix** — matches any path starting with the fixed prefix | `/details/book/page5` ✅, `/other/details/` ❌ |
| **No** `*` (`__ia_thumb.jpg`) | **Exact** — matches only that specific path | `/__ia_thumb.jpg` ✅, `/download/__ia_thumb.jpg` ❌ |
| **Middle** `*` (`file.*.txt`) | **Anchored wildcard** — matches with fixed start/end | `/file.report.txt` ✅, `/other/file.1.txt` ❌ |

All non-leading-`*` patterns are **anchored** — they must match from the start of the pathname, so `details/*` won't match `/other/details/`.

### Substring match (leading `*`)

Use when you want to allow a file or directory anywhere in the path:

```
ALLOWED_TARGET = archive.org/*/__ia_thumb
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://archive.org/download/book1/__ia_thumb.jpg` | ✅ Contains `/__ia_thumb` |
| `https://cors-proxy.../https://archive.org/download/mars/__ia_thumb.jpg` | ✅ Contains `/__ia_thumb` |
| `https://cors-proxy.../https://archive.org/details/abc/__ia_thumb` | ✅ Contains `/__ia_thumb` |
| `https://cors-proxy.../https://archive.org/download/other.txt` | ❌ No `__ia_thumb` anywhere |

### Prefix match (trailing `*`)

Use when you want to allow any path under a specific directory:

```
ALLOWED_TARGET = archive.org/details/*
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://archive.org/details/somebook` | ✅ Matches prefix `/details/` |
| `https://cors-proxy.../https://archive.org/details/somebook/page5` | ✅ Matches prefix |
| `https://cors-proxy.../https://archive.org/details/` | ✅ Matches prefix |
| `https://cors-proxy.../https://archive.org/other/details/` | ❌ Anchored — prefix must start at root |

This also works with `*` in the middle of the pattern:

```
ALLOWED_TARGET = example.com/api/*/status
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://example.com/api/v1/status` | ✅ Fixed `/api/` prefix, `*` matches `v1`, fixed `/status` suffix |
| `https://cors-proxy.../https://example.com/api/v2/status` | ✅ |
| `https://cors-proxy.../https://example.com/other/api/v1/status` | ❌ Anchored — must start at root |

### Exact match (no `*`)

Use when you want to allow only one specific path:

```
ALLOWED_TARGET = example.com/api/status
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://example.com/api/status` | ✅ Exact match |
| `https://cors-proxy.../https://example.com/api/status?foo=1` | ✅ Pathname matches (query ignored) |
| `https://cors-proxy.../https://example.com/api/status/` | ❌ Trailing slash changes path |
| `https://cors-proxy.../https://example.com/v2/api/status` | ❌ Different path |

---

## Multiple Path Patterns (Pipe Syntax)

Use `|` to specify multiple patterns for the same hostname. The request is allowed if **any** pattern matches.

```
ALLOWED_TARGET = archive.org/*/__ia_thumb|*_page_numbers.json|*_archive.torrent
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://archive.org/download/book1/__ia_thumb.jpg` | ✅ Matches `*/__ia_thumb` |
| `https://cors-proxy.../https://archive.org/download/book1/book1_page_numbers.json` | ✅ Matches `*_page_numbers.json` |
| `https://cors-proxy.../https://archive.org/download/game/game_archive.torrent` | ✅ Matches `*_archive.torrent` |
| `https://cors-proxy.../https://archive.org/download/readme.txt` | ❌ No pattern matches |

You can mix substring and exact patterns in the pipe list:

```
ALLOWED_TARGET = archive.org/robots.txt|*/__ia_thumb|*_page_numbers.json
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://archive.org/robots.txt` | ✅ Exact match |
| `https://cors-proxy.../https://archive.org/download/x/__ia_thumb.jpg` | ✅ Substring match |
| `https://cors-proxy.../https://archive.org/details/book_page_numbers.json` | ✅ Substring match |
| `https://cors-proxy.../https://archive.org/sitemap.xml` | ❌ No pattern matches |

---

## Full URL Format

Instead of `hostname/path`, you can write entries as full URLs. The hostname and path are extracted automatically.

```
ALLOWED_TARGET = https://archive.org/details/
```

This is equivalent to `archive.org/details/`. Useful when copying URLs directly from your browser:

```
ALLOWED_TARGET = https://jsonplaceholder.typicode.com/posts,https://archive.org/details/
```

| Format | Parsed hostname | Parsed path pattern |
|--------|----------------|---------------------|
| `https://archive.org/details/somebook` | `archive.org` | `details/somebook` |
| `https://archive.org/details/` | `archive.org` | `details/` |
| `https://archive.org` | `archive.org` | (none — hostname-only) |

> [!NOTE]  
> The full URL form is a convenience alternative. The hostname+path form (`archive.org/details/somebook`) is functionally identical and usually more readable in config files.

---

## Wildcard Subdomain Hostnames

Use `*.` prefix to match **any subdomain** of a domain:

```
ALLOWED_TARGET = *.example.com
```

| Hostname | Matches? |
|----------|----------|
| `api.example.com` | ✅ |
| `www.example.com` | ✅ |
| `deep.sub.example.com` | ✅ |
| `example.com` | ❌ (bare domain not included) |

Combine with path patterns:

```
ALLOWED_TARGET = *.archive.org/*/__ia_thumb
```

| Proxy URL | Result |
|-----------|--------|
| `https://cors-proxy.../https://books.archive.org/download/x/__ia_thumb.jpg` | ✅ Subdomain + path matches |
| `https://cors-proxy.../https://archive.org/download/x/__ia_thumb.jpg` | ❌ Bare domain not matched by `*.` |

> **Safety validation:** Wildcards targeting a public suffix (like `*.com`, `*.co.uk`) are **automatically rejected** at config parse time — they would match every domain under that suffix.

---

## Mixing Entry Types

All entry types can be combined in a single comma-separated list:

```
ALLOWED_TARGET =
  jsonplaceholder.typicode.com,
  archive.org/*/__ia_thumb|*_page_numbers.json|*_archive.torrent,
  *.github.io,
  https://example.com/api/status
```

A request is allowed if **any entry** matches — so you can grant broad access to some hosts and narrow access to others.

---

## Common Configurations

### Single API, any path
```
ALLOWED_TARGET = jsonplaceholder.typicode.com
```

### Single API, specific endpoint only
```
ALLOWED_TARGET = jsonplaceholder.typicode.com/posts
```

### Internet Archive thumbnails
```
ALLOWED_TARGET = archive.org/*/__ia_thumb|*_page_numbers.json|*_archive.torrent
```

### All paths under a directory
```
ALLOWED_TARGET = archive.org/details/*
```

### Multiple independent APIs
```
ALLOWED_TARGET = api.github.com,jsonplaceholder.typicode.com,openlibrary.org
```

### Subdomains with path restriction
```
ALLOWED_TARGET = *.archive.org/*/__ia_thumb
```

### Mixed strict and permissive
```
ALLOWED_TARGET =
  example.com/robots.txt,        # exact path only
  api.example.com,               # any path on api subdomain
  *.example.com/status           # exact path on any subdomain
```

---

## Security Notes

- **Path traversal via `%2f` is blocked.** Percent-encoded slashes are decoded before matching, so `__ia_thumb%2f..%2f..%2fetc` correctly normalises to `/etc/passwd` and is rejected.
- **Hostname wildcards cannot target public suffixes.** `*.com`, `*.co.uk`, `*.s3.amazonaws.com` are rejected automatically.
- **Hostname-only rules always allow any path** on that host. Use path patterns if you need narrower access.
- **`*` matches across `/` boundaries.** Pattern `*/secret` would match `/foo/secret` and `/foo/bar/secret`. This is intentional — path segments are not special to the wildcard.
- **Subdomain wildcard does not include the bare domain.** `*.example.com` does not match `example.com`. Add both if needed: `*.example.com,example.com`.

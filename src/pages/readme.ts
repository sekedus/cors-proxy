/**
 * Embedded README content – fallback when the actual README.md can't be fetched.
 */
export function getEmbeddedReadme(): string {
	return `# CORS Proxy

A secure, configurable CORS proxy for Cloudflare Workers.

## Features

### Server-Side Configuration

| Option | Description |
|--------|-------------|
| \`allowed_site\` | Comma-separated list of allowed origins (Origin header, fallback to Referer). Empty = allow any site. |
| \`allowed_target\` | Comma-separated list of allowed target hosts. Empty = allow any target. |
| \`blacklist_site\` | Comma-separated list of blacklisted origins. |
| \`remove_headers\` | Comma-separated list of headers to remove from outbound request (e.g., \`cookie\`). |
| \`require_header\` | Comma-separated list of headers the client must include. Prevents casual browsing. |
| \`dev_param\` | Query parameter name that activates dev mode (bypasses all restrictions). Empty = dev mode disabled. |
| \`dev_value\` | If set, dev mode only activates when the dev param value matches exactly. Empty = any value works. |
| \`max_body_size\` | Maximum request body size (e.g., \`10MB\`, \`1GB\`, \`500KB\`). Larger requests are rejected with 413. Empty or \`0\` = no limit. |

> **Tip:** You can use full URLs in \`allowed_site\`, \`allowed_target\`, and \`blacklist_site\` — the proxy automatically extracts the hostname. For example, \`https://web.archive.org\` is treated as \`web.archive.org\`.

### Client-Side Features

#### Header Override via Request Headers (like corsfix)

Add \`x-corsproxy-headers\` to your request with a JSON-stringified object:

\`\`\`js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Origin': 'https://allowed-origin.com',
      'User-Agent': 'CustomAgent/1.0'
    })
  }
})
\`\`\`

Add \`x-corsproxy-res-headers\` to override response headers:

\`\`\`js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-res-headers': JSON.stringify({
      'Access-Control-Allow-Origin': 'https://myapp.com',
      'X-Custom': 'value'
    })
  }
})
\`\`\`

#### Header Override via Query Parameters (like corsproxy.io)

\`\`\`
https://your-proxy.workers.dev/?url=https://api.example.com&reqHeaders=accept:application/json&reqHeaders=authorization:Bearer%20TOKEN
\`\`\`

\`\`\`
https://your-proxy.workers.dev/?url=https://api.example.com&resHeaders=content-type:application/json&resHeaders=cache-control:no-cache
\`\`\`

To remove a header, pass an empty value:

\`\`\`
https://your-proxy.workers.dev/?url=https://example.com&resHeaders=x-frame-options:
\`\`\`

#### Dev Mode

Add \`?dev=true\` (or custom \`DEV_PARAM\`) to bypass all server restrictions:

\`\`\`
https://your-proxy.workers.dev/?url=https://api.example.com&dev=true
\`\`\`

You can also set \`DEV_VALUE\` to require an exact value — only \`?dev=<secret>\` activates dev mode.

### URL Resolution Priority

1. **Path-based** — If the request path has a protocol prefix (\`https://...\` or \`http://...\`), that's the target
2. **\`?url=\` parameter** — Falls back to the \`?url=<target>\` query parameter
3. **\`404\`** — If neither is provided, returns an error

### URL Schemes

- \`/\` – Homepage with this documentation
- \`/?url=<target>\` – Proxy with query param target
- \`/<protocol>://<host>/<path>\` – Proxy with path-based target
- \`/<host>/<path>\` – Proxy (defaults to https://)

### Usage Examples

**Basic (path-based, like cors-anywhere):**
\`\`\`
https://your-proxy.workers.dev/https://api.example.com/data
\`\`\`

**Query-based (like corsproxy.io):**
\`\`\`
https://your-proxy.workers.dev/?url=https://api.example.com/data
\`\`\`

**With header overrides:**
\`\`\`js
fetch('https://your-proxy.workers.dev/https://api.example.com/data', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({ 'Authorization': 'Bearer my-token' }),
    'x-corsproxy-res-headers': JSON.stringify({ 'X-Debug': 'true' })
  }
})
\`\`\`

## Deployment

\`\`\`bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
npm run deploy

# Local development
npm run dev
\`\`\`

## License

GNU General Public License v3.0
`;
}

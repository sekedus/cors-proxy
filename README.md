# CORS Proxy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sekedus/cors-proxy)

A secure, configurable CORS proxy for Cloudflare Workers.

## Features

### Server-Side Configuration

Configure via environment variables / `wrangler.jsonc` `vars`:

| Variable | Description |
|----------|-------------|
| `ALLOWED_SITE` | Comma-separated list of allowed origins (Origin header, fallback to Referer). Empty = allow any site. |
| `ALLOWED_TARGET` | Comma-separated list of allowed target hosts. Empty = allow any target. |
| `BLACKLIST_SITE` | Comma-separated list of blacklisted origins. |
| `REMOVE_HEADERS` | Comma-separated list of headers to remove from outbound request (e.g., `cookie`). |
| `REQUIRE_HEADER` | Comma-separated list of headers the client must include. Prevents casual browsing. Example: `Origin, X-Requested-With` |

### Client-Side Features

#### Header Override via Request Headers (like corsfix)

Add `x-corsproxy-headers` to your request with a JSON-stringified object to override request headers:

```js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Origin': 'https://allowed-origin.com',
      'User-Agent': 'CustomAgent/1.0'
    })
  }
})
```

Add `x-corsproxy-res-headers` to override response headers:

```js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-res-headers': JSON.stringify({
      'Access-Control-Allow-Origin': 'https://myapp.com',
      'X-Custom': 'value'
    })
  }
})
```

#### Header Override via Query Parameters (like corsproxy.io)

Override request headers:

```
https://your-proxy.workers.dev/?url=https://api.example.com&reqHeaders=accept:application/json&reqHeaders=authorization:Bearer%20TOKEN
```

Override response headers:

```
https://your-proxy.workers.dev/?url=https://api.example.com&resHeaders=content-type:application/json&resHeaders=cache-control:no-cache
```

To remove a header, pass an empty value:

```
https://your-proxy.workers.dev/?url=https://example.com&resHeaders=x-frame-options:
```

#### Dev Mode

Add `dev=true` to bypass all server restrictions (useful for development):

```
https://your-proxy.workers.dev/?url=https://api.example.com&dev=true
```

### Usage Examples

**Basic (path-based, like cors-anywhere):**
```
https://your-proxy.workers.dev/https://api.example.com/data
```

**Query-based (like corsproxy.io):**
```
https://your-proxy.workers.dev/?url=https://api.example.com/data
```

**With React/fetch:**
```js
const response = await fetch('https://your-proxy.workers.dev/https://jsonplaceholder.typicode.com/posts/1');
const data = await response.json();
console.log(data);
```

**With jQuery:**
```js
$.getJSON('https://your-proxy.workers.dev/https://jsonplaceholder.typicode.com/posts/1', function(data) {
  console.log(data);
});
```

### URL Schemes

- `/` – Homepage with this documentation
- `/?url=<target>` – Proxy with query param target
- `/<protocol>://<host>/<path>` – Proxy with path-based target
- `/<host>/<path>` – Proxy (defaults to https://)

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed via npm)

### Setup

```bash
# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Deploy to Cloudflare Workers
npm run deploy

# Or deploy to production environment
npm run deploy:prod
```

### Configure Environment

Edit `wrangler.jsonc` to set configuration variables:

```jsonc
{
  "vars": {
    "ALLOWED_SITE": "mysite.com,anotherapp.com",
    "ALLOWED_TARGET": "api.example.com,jsonplaceholder.typicode.com",
    "BLACKLIST_SITE": "bad-site.com",
    "REMOVE_HEADERS": "cookie,authorization",
    "REQUIRE_HEADER": "Origin,X-Requested-With"
  }
}
```

For sensitive values, use `wrangler secret put`:

```bash
npx wrangler secret put ALLOWED_SITE
```

### Local Development

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`.

## GitHub Repository

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit: CORS proxy for Cloudflare Workers"

# Add your GitHub repo
git remote add origin https://github.com/YOUR_USERNAME/cors-proxy.git
git push -u origin main
```

## References

- [Cloudflare Workers CORS header proxy example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/)
- [Cloudflare docs-examples (GitHub)](https://github.com/cloudflare/docs-examples/tree/main/workers/cors-header-proxy)
- [corsfix.com – Header Override docs](https://corsfix.com/docs/cors-proxy/header-override)
- [corsproxy.io – Header Rewrites docs](https://corsproxy.io/docs/header-rewrites/)
- [cors-anywhere by Rob--W](https://github.com/Rob--W/cors-anywhere)

## License

[GNU General Public License v3.0](./LICENSE)

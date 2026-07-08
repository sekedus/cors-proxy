# CORS Proxy

A CORS proxy that runs on [Cloudflare Workers](https://workers.cloudflare.com/). It lets your frontend code make HTTP requests to any API, even when that API doesn't send CORS headers.

<br/>

## 🤔 What Is a CORS Proxy?

Web browsers block JavaScript from making requests to a different domain unless that domain sends special **CORS headers**. Many public APIs don't send these headers.

A CORS proxy sits between your code and the API, adding the missing headers so the browser accepts the response.

For example, instead of:
```
❌ fetch('https://api.example.com/endpoint')    ← blocked by browser
```
You write:
```
✅ fetch('https://your-proxy.workers.dev/https://api.example.com/endpoint')    ← works
```

<br/>

## 🚀 Quick Start (10 minutes)

### 1. Prerequisites

- A **Cloudflare account** ([free sign-up](https://dash.cloudflare.com/sign-up))
- **Node.js 18+** installed ([download](https://nodejs.org/))
- **Git** installed ([download](https://git-scm.com/downloads))
- Basic familiarity with the terminal

### 2. Clone & Install

```bash
# Clone the repository
git clone https://github.com/sekedus/cors-proxy.git
cd cors-proxy

# Install dependencies
npm install

# Log in to your Cloudflare account (opens a browser window)
npx wrangler login
```

### 3. Deploy

```bash
npm run deploy
```

After a few seconds you'll see a URL like `https://cors-proxy.your-name.workers.dev`. **That's your live proxy.**

Try it:

```
https://cors-proxy.your-name.workers.dev/https://jsonplaceholder.typicode.com/posts/1
```

### 4. Set Your Configuration (Environment Variables)

Open your worker in the [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → select `cors-proxy` → **Settings** → **Variables and Secrets**.

Click **Add**, select **Type → Text**, enter the variable name and value, then deploy. The **Text** type keeps values visible and editable in the dashboard (use **Secret** for sensitive data like API keys).

| Variable | What to put |
|----------|-------------|
| `ALLOWED_SITE` | Comma-separated allowed origins. Leave empty to allow any site. |
| `ALLOWED_TARGET` | Comma-separated allowed target hosts. Leave empty to allow any target. |
| `BLACKLIST_SITE` | Origins to block (comma-separated). |
| `REMOVE_HEADERS` | Headers to strip from outgoing requests (e.g., `cookie`). |
| `REQUIRE_HEADER` | Headers the client must send (e.g., `Origin, X-Requested-With`). |
| `DEV_PARAM` | Query param that activates dev mode. Leave empty to disable dev mode. |
| `DEV_VALUE` | If set, dev mode only activates when the dev param matches this exact value. |

> [!NOTE]  
> **Text vs Secret:** Set these as **Text** (not Secret) so you can always see and edit them in the dashboard. Use **Secret** type for sensitive data like API keys.  
> Dashboard variables won't be overwritten during deploy thanks to `keep_vars: true` in `wrangler.jsonc`.

### 5. Set MAX_BODY_SIZE

`MAX_BODY_SIZE` (default: `10MB`) controls the maximum request body the proxy will forward. This is pre-configured in `wrangler.jsonc` but you can also override it in the dashboard if needed.

<br/>

## 📖 How to Use the Proxy

### URL Formats

The proxy understands two URL styles:

**Path-style (recommended for simplicity):**
```
https://your-proxy.workers.dev/https://api.example.com/endpoint
```

**Query-style:**
```
https://your-proxy.workers.dev/?url=https://api.example.com/endpoint
```

The proxy checks the path **first**. If the path starts with `http://` or `https://`, that's your target. Otherwise it falls back to the `?url=` parameter.

### Common Use Cases

**Fetching JSON for your frontend:**
```js
const response = await fetch('https://your-proxy.workers.dev/https://api.example.com/endpoint');
const data = await response.json();
```

**Overriding request headers:**
```js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Authorization': 'Bearer my-token',
      'User-Agent': 'MyApp/1.0'
    })
  }
})
```

**Overriding response headers:**
```js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-res-headers': JSON.stringify({
      'Access-Control-Allow-Origin': 'https://myapp.com'
    })
  }
})
```

**Using query parameters instead of request headers:**
```
https://your-proxy.workers.dev/?url=https://api.example.com&reqHeaders=accept:application/json&resHeaders=cache-control:no-cache
```

**Removing a header (pass empty value):**
```
https://your-proxy.workers.dev/?url=https://example.com&resHeaders=x-frame-options:
```

**Setting forbidden headers (browsers block these):**

Browsers won't let JavaScript set certain headers – `Origin`, `Referer`, `Cookie`, `Accept-Encoding`, and others are [forbidden](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header) in `fetch()` / `XMLHttpRequest`.

The proxy bypasses this because it sets headers server-side, outside the browser's restrictions:

```js
fetch('https://your-proxy.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Origin': 'https://my-frontend.com',
      'Cookie': 'session=abc123'
    })
  }
})
```

> [!NOTE]  
> `Cookie` and `Authorization` in request headers are subject to your `REMOVE_HEADERS` secret – if they're listed there, they'll be stripped even if you send them via `x-corsproxy-headers`.  
> See the [Configuration Reference](#-configuration-reference) for details.

<br/>

## 🧪 Interactive Pages

Your proxy comes with built-in web pages:

| Page | URL | What it does |
|------|-----|--------------|
| Home | `/` | Rendered documentation |
| Test | `/test` | Shows config + simple try-it box |
| Playground | `/playground` | Full sandbox – method, headers, body, inspect responses |

<br/>

## 🛠️ Development

### Run Locally

```bash
# Create your local environment file
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your values (it's gitignored)

# Start the dev server
npm run dev
```

Your proxy runs at `http://localhost:8787`.

### Run Tests

```bash
npm run test
```

Testing includes configuration parsing, URL resolution, header handling, and byte-size parsing.

<br/>

## 🔧 Configuration Reference

### Text Variables (set via dashboard – not secrets)

All configuration variables are **Text-type environment variables** set in the Cloudflare dashboard (as opposed to **Secret** type). They stay viewable and editable after saving.

| Variable | Where to set | Purpose | Example / Default |
|----------|-------------|---------|-------------------|
| `ALLOWED_SITE` | Dashboard | Only allow requests from these origins | `mysite.com,anotherapp.com` |
| `ALLOWED_TARGET` | Dashboard | Only allow requests to these hosts | `api.example.com` |
| `BLACKLIST_SITE` | Dashboard | Block requests from these origins | `bad-site.com` |
| `REMOVE_HEADERS` | Dashboard | Strip these headers from outgoing requests | `cookie,authorization` |
| `REQUIRE_HEADER` | Dashboard | Reject requests missing these headers | `Origin,X-Requested-With` |
| `DEV_PARAM` | Dashboard | Query param name to activate dev mode | `dev` (or empty to disable) |
| `DEV_VALUE` | Dashboard | Requires dev param to match this exact value | `my-secret` |
| `MAX_BODY_SIZE` | `wrangler.jsonc` or dashboard | Maximum request body the proxy will forward | `10MB` |

> [!TIP]  
> **URL-like entries:** You can write full URLs in `ALLOWED_SITE`, `ALLOWED_TARGET`, and `BLACKLIST_SITE` – the proxy automatically extracts the hostname.  
> For example, `https://web.archive.org` is treated as `web.archive.org`.

**How variables interact:** If `ALLOWED_SITE` is empty, any origin is allowed. If it has values, only matching origins pass. `BLACKLIST_SITE` is checked after `ALLOWED_SITE` – if an origin is both allowed and blacklisted, it's blocked. `REQUIRE_HEADER` is checked last.

### Dev Mode

Dev mode bypasses **all** restrictions (allowed_site, allowed_target, blacklist_site, require_header). It's useful during development.

Activation depends on three cases:

| `DEV_PARAM` | `DEV_VALUE` | How to activate |
|-------------|-------------|-----------------|
| Set to `dev` | Set to `secret` | `?dev=secret` (exact match required) |
| Set to `dev` | Empty / unset | `?dev=true`, `?dev`, or `?dev=anything` (any value works) |
| Empty / unset | – | Dev mode is **disabled** (always production) |

Examples:
```
# DEV_PARAM=dev, DEV_VALUE= (any value works)
https://your-proxy.workers.dev/?url=https://api.example.com&dev=true

# DEV_PARAM=dev, DEV_VALUE=secret (exact match required)
https://your-proxy.workers.dev/?url=https://api.example.com&dev=secret
```

**Interactive pages** (playground, test page) automatically forward the dev parameter from the page URL to proxy requests, so you only need to add `?dev=secret` once in your browser.

<br/>

## ☁️ Cloudflare-Specific Notes

- **`keep_vars: true`** – Prevents Wrangler from overwriting environment variables you set via the dashboard when you run `wrangler deploy`. Your dashboard values stay intact across deploys.
- **No secrets used** – All configuration is stored as **Text-type** environment variables (not **Secret** type), so you can always view and edit them in the dashboard.
- **No GPU needed** – Cloudflare Workers are CPU-only. This proxy doesn't use GPU at all.

<br/>

## 📚 References

- [Cloudflare Workers CORS header proxy example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/)
- [Cloudflare Workers environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [corsfix.com – Header Override docs](https://corsfix.com/docs/cors-proxy/header-override)
- [corsproxy.io – Header Rewrites docs](https://corsproxy.io/docs/header-rewrites/)
- [cors-anywhere by Rob--W](https://github.com/Rob--W/cors-anywhere)

## License

[GNU General Public License v3.0](./LICENSE)

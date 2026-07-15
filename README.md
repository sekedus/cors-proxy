# CORS Proxy

<picture>![GitHub repo size](https://img.shields.io/github/repo-size/sekedus/cors-proxy?label=Size)</picture>
[![GitHub License](https://img.shields.io/github/license/sekedus/cors-proxy?label=License)](./LICENSE)

A CORS proxy that runs on [Cloudflare Workers](https://workers.cloudflare.com/). It lets your frontend code make HTTP requests to any API, even when that API doesn't send CORS headers.

<br/>

<details>
<summary><strong>📑 Table of Contents</strong></summary>

<br/>

- [What Is a CORS Proxy?](#-what-is-a-cors-proxy)
- [Quick Start](#-quick-start)
  - [Option A: Deploy Button](#option-a-deploy-button)
  - [Option B: Via the Cloudflare Dashboard](#option-b-via-the-cloudflare-dashboard)
  - [Option C: From Your Local PC](#option-c-from-your-local-pc)
  - [Configure Your Proxy](#configure-your-proxy-optional--all-methods)
- [How to Use the Proxy](#-how-to-use-the-proxy)
  - [URL Formats](#url-formats)
  - [Common Use Cases](#common-use-cases)
  - [Using from a Local HTML File](#using-from-a-local-html-file)
- [How the Proxy Processes Your Request](#%EF%B8%8F-how-the-proxy-processes-your-request)
- [Interactive Pages](#-interactive-pages)
- [Development](#%EF%B8%8F-development)
  - [Run Locally](#run-locally)
  - [Start the Dev Server](#start-the-dev-server)
  - [Run Tests](#run-tests)
- [Configuration Reference](#-configuration-reference)
  - [Text Variables](#text-variables)
  - [Safe Minimum Configuration](#-safe-minimum-configuration-production)
  - [Dev Mode](#dev-mode)
- [Troubleshooting](#-troubleshooting)
- [Cloudflare-Specific Notes](#%EF%B8%8F-cloudflare-specific-notes)
- [References](#-references)
- [License](#license)

</details>

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
✅ fetch('https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com/endpoint')    ← works
```

<br/>

## 🚀 Quick Start

Choose the deployment method that suits you best.

All three options produce a working proxy at `https://cors-proxy.<your-subdomain>.workers.dev`.

---

### Option A: Deploy Button

Click the button below to deploy instantly via the Cloudflare dashboard:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sekedus/cors-proxy)

1. You'll be taken to the **Cloudflare dashboard**.
2. Connect to your **GitHub/GitLab** account.
3. Give it a name (e.g. `cors-proxy`) and click **Deploy**.
4. Wait until the build process is complete.
5. Reload the page and click **Visit** to see your live proxy.

---

### Option B: Via the Cloudflare Dashboard

1. Fork this repository to your GitHub account.
2. In the Cloudflare Dashboard, go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
3. Click **Create application**.
4. Connect your GitHub account, select the forked repository and click **Next**.
5. Give it a name (e.g. `cors-proxy`) and click **Deploy**.
6. Wait until the build process is complete.
7. Reload the page and click **Visit** to see your live proxy.

---

### Option C: From Your Local PC

**Prerequisites:**

- A **Cloudflare account** ([login/sign-up](https://dash.cloudflare.com))
- **Node.js 22+** installed ([download](https://nodejs.org/en/download/))
- **Git** installed ([download](https://git-scm.com/downloads))
- Basic familiarity with the terminal

<br/>

Run the following commands:

```bash
# Clone the repository
git clone https://github.com/sekedus/cors-proxy.git
cd cors-proxy

# Install dependencies
npm install

# Log in to your Cloudflare account (opens a browser window)
npx wrangler login

# Deploy
npm run deploy
```

Wait until the build process is complete. Your live proxy will be available at `https://cors-proxy.<your-subdomain>.workers.dev`.

Try it:

```
https://cors-proxy.<your-subdomain>.workers.dev/https://jsonplaceholder.typicode.com/posts/1
```

---

### Configure Your Proxy (Optional – all methods)

1. In the Cloudflare Dashboard, go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages), select your worker (`cors-proxy`), then go to **Settings**.
2. Under **Variables and Secrets**, click **+ Add**.
3. Select **Type → Text**, enter the variable name and value.  
   Repeat for each variable you want to set.
4. Click **Deploy** to save your changes.
5. See the [Configuration Reference](#-configuration-reference) below for all available variables and how they work.

<br/>

## 📖 How to Use the Proxy

### URL Formats

The proxy understands two URL styles:

**Path-style (recommended for simplicity):**
```
https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com/endpoint
```

**Query-style:**
```
https://cors-proxy.<your-subdomain>.workers.dev/?url=https://api.example.com/endpoint
```

The proxy checks the path **first**. If the path starts with `http://` or `https://`, that's your target. Otherwise it falls back to the `?url=` parameter.

<br/>

> [!NOTE]  
> **Path without protocol:**  
> If you write `/<host>/<path>` without `http://` or `https://`, the proxy will treat it as `https://<host>/<path>` **only if** the hostname contains a dot (`.`) or a colon (`:`).  
> A path like `/myapp/data` or `/localhost` won't be treated as a target – it will fall through to the `?url=` parameter or return an error.
>
> **Protocol support:**  
> The proxy only supports `http://` and `https://` targets.  
> Other protocols (`ftp://`, `file://`, `ws://`, etc.) are rejected with a `400 Invalid target URL` response.  
> This is because Cloudflare Workers' `fetch()` does not support them ([reference](https://developers.cloudflare.com/workers/reference/protocols/)).

---

### Common Use Cases

#### Fetching JSON for your frontend:
```js
const response = await fetch('https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com/endpoint');
const data = await response.json();
```

---

#### Overriding request headers:
```js
fetch('https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Authorization': 'Bearer my-token',
      'User-Agent': 'MyApp/1.0'
    })
  }
})
```

---

#### Overriding response headers:
```js
fetch('https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-res-headers': JSON.stringify({
      'Access-Control-Allow-Origin': 'https://myapp.com'
    })
  }
})
```

---

#### Using query parameters instead of request headers:
```
https://cors-proxy.<your-subdomain>.workers.dev/?url=https://api.example.com&reqHeaders=accept:application/json&resHeaders=cache-control:no-cache
```

---

#### Removing a header (pass empty value):
```
https://cors-proxy.<your-subdomain>.workers.dev/?url=https://example.com&resHeaders=x-frame-options:
```

---

#### Setting forbidden headers (browsers block these):

Browsers won't let JavaScript set certain headers – `Origin`, `Referer`, `Cookie`, `Accept-Encoding`, and others are [forbidden](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header) in `fetch()` / `XMLHttpRequest`.

The proxy bypasses this because it sets headers server-side, outside the browser's restrictions:

```js
fetch('https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com', {
  headers: {
    'x-corsproxy-headers': JSON.stringify({
      'Origin': 'https://my-frontend.com',
      'Cookie': 'session=abc123'
    })
  }
})
```

<br/>

> [!IMPORTANT]  
> `Cookie`, `Authorization`, and any header listed in `REMOVE_HEADERS` are stripped **after** your overrides are applied – they cannot be re-added.  
> See the [Configuration Reference](#-configuration-reference) for details.
>
> **Overriding response headers:**  
> `Set-Cookie` cannot be overridden via `x-corsproxy-res-headers` or `resHeaders`. This is blocked to prevent cross-user cookie injection in shared proxy deployments.

---

### Using from a Local HTML File

When you open an HTML file directly from disk (e.g., `file:///D:/project/index.html`), the browser sends no `Origin` header.

In production mode, this means the request will be rejected if `ALLOWED_SITE`, `BLACKLIST_SITE`, or `REQUIRE_HEADER` (with auto-required `Origin`) is configured.

You have two options:

**Option 1 – Serve your HTML via HTTP**

Start a local HTTP server so the browser treats it as a proper origin:

```bash
# Run a simple Node.js server in the current directory
npx serve .
```

Then open http://localhost:3000/ instead of the `file:///` path.

Now `Origin` will be sent, and the proxy will work normally.

---

**Option 2 – Use dev mode**

Dev mode bypasses all access control restrictions. Set `DEV_PARAM` (and optionally `DEV_VALUE`) in your config, then append the dev parameter to your proxy URL:

```
https://cors-proxy.<your-subdomain>.workers.dev/https://api.example.com/?dev=your-value
```

See the [Dev Mode](#dev-mode) section for details.

<br/>

## ⚙️ How the Proxy Processes Your Request

<details>
<summary>When you send a request to the proxy, here's what happens step by step:</summary>

<br/>

1. **Routing**:  
   The path is checked against `/`, `/test`, and `/playground`.  
   If it matches one of those, the corresponding page is served.
2. **Target resolution**:  
   The target URL is extracted from the path (preferred) or the `?url=` query parameter.
3. **SSRF protection**:  
   If the resolved target hostname is a private or reserved IP address (e.g. `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `localhost`), the request is blocked with a `403` response.  
   This is a defence-in-depth measure – only active in production mode.  
   See the [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) for the blocked ranges.
4. **Access control**:  
   In production mode, the proxy checks `ALLOWED_SITE`, `BLACKLIST_SITE`, `ALLOWED_TARGET`, and `REQUIRE_HEADER` in order.  
   `ALLOWED_TARGET` supports path patterns with `*` wildcards and `|` separators — see the [full reference](./docs/allowed-target.md).  
   Only the `Origin` header is used for origin detection – `Referer` is not trusted as a fallback.  
   Dev mode bypasses these checks (but `MAX_BODY_SIZE` and `REMOVE_HEADERS` still apply).  
   See [Allowed / Blacklisted Sites](#allowed--blacklisted-sites) for details on how `Origin` is auto-required when origin-based access control is active.
5. **Body size check**:  
   If `MAX_BODY_SIZE` is set, the request body is checked via `Content-Length` header first (fast-path rejection), then the full body is always read to verify the actual size.  
   This prevents bypasses via falsified `Content-Length` with chunked encoding.  
   Requests exceeding the limit get a `413` response.  
   The body is only read **after** access control passes, preventing blocked origins from consuming memory.
6. **Header overrides**:  
   Your `x-corsproxy-headers` / `reqHeaders` values are applied to the outgoing request.
7. **REMOVE_HEADERS**:  
   Any headers listed in `REMOVE_HEADERS` are stripped (hard boundary – this happens after overrides).
8. **Origin rewrite**:  
   The `Origin` header is set to the **target's origin** (not the client's).  
   This prevents the target server from seeing a cross-origin request and rejecting it.
9. **Hop-by-hop headers removed**:  
   Headers like `Connection`, `Transfer-Encoding`, `Upgrade` are stripped to avoid interfering with the Worker's own HTTP stack.
10. **Fetch target**:  
   The proxied request is sent to the target URL.
11. **CORS headers added**:  
   The response gets `Access-Control-Allow-Origin` (echoing your origin, or `*` if none), `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`.  
   If a specific origin is echoed, `Vary: Origin` is also added to help CDNs cache correctly.
12. **Response header overrides**:  
   Your `x-corsproxy-res-headers` / `resHeaders` values are applied to the response.  
   `Set-Cookie` is blocked from overrides – see [Common Use Cases](#common-use-cases) for why.

</details>

<br/>

## 🧪 Interactive Pages

Your proxy comes with built-in web pages:

| Page | URL | What it does |
|------|-----|--------------|
| Home | `/` | Rendered documentation |
| Test | `/test` | Shows config + simple try-it box |
| Playground | `/playground` | Full sandbox – method, headers, body, inspect responses |

> [!IMPORTANT]  
> **About the homepage:**  
> The `/` page renders its content from [src/pages/readme.ts](./src/pages/readme.ts), not from this `README.md` file directly.  
> If you update this README, remember to also update the embedded version in `src/pages/readme.ts` so the homepage stays in sync.

<br/>

## 🛠️ Development

### Run Locally

```bash
# Create your local environment file

cp .dev.vars.example .dev.vars    # Linux/macOS

Copy-Item .dev.vars.example .dev.vars    # Windows (PowerShell)

# Edit .dev.vars with your values
```

### Start the dev server

```
npm run dev
```

Your proxy runs at `http://localhost:8787`.

### Run Tests

Testing uses [Vitest](https://vitest.dev/) and covers configuration parsing, URL resolution, header handling, and byte-size parsing.

```bash
# Run all tests once (what you'll use most often)
npm run test

# Run only a single test file – faster when debugging one module
npx vitest tests/config.test.ts

# Watch mode – re-runs tests automatically when files change
npx vitest --watch
```

<br/>

## 🔧 Configuration Reference

### Text Variables

All configuration variables are **Text-type environment variables** set in the Cloudflare dashboard (as opposed to **Secret** type). They stay viewable and editable after saving.

| Variable | Where to set | Purpose | Example / Default |
|----------|-------------|---------|-------------------|
| `ALLOWED_SITE` | Dashboard | Only allow requests from these origins | `mysite.com,https://another-site.com/` |
| `ALLOWED_TARGET` | Dashboard | Only allow requests to these hosts and paths (see [full docs](./docs/allowed-target.md)) | `example.com,*.archive.org/*/__ia_thumb\|_page_numbers.json` |
| `BLACKLIST_SITE` | Dashboard | Block requests from these origins | `bad-site.com,spam-site.com` |
| `REMOVE_HEADERS` | Dashboard | Strip these headers from outgoing requests | `cookie,Authorization` |
| `REQUIRE_HEADER` | Dashboard | Reject requests missing these headers | `Origin,x-requested-with` |
| `DEV_PARAM` | Dashboard | Query param name to activate dev mode | `dev`, `admin` (or empty to disable) |
| `DEV_VALUE` | Dashboard | Requires dev param to match this exact value | `my-secret` |
| `MAX_BODY_SIZE` | `wrangler.jsonc` or dashboard | Maximum request body the proxy will forward | `10MB` |

> [!NOTE]  
> These variables are **optional**. If you just deployed the proxy, it's already working with no restrictions. Only set these when you want to lock things down.  
> List-type variables (`ALLOWED_SITE`, `ALLOWED_TARGET`, `BLACKLIST_SITE`, `REMOVE_HEADERS`, `REQUIRE_HEADER`) take **comma-separated** values.

---

### 🔒 Safe Minimum Configuration (Production)

If you're deploying this proxy for anything beyond personal experimentation, **lock it down with at least these settings**:

| Variable | What to set | Why |
|----------|-------------|-----|
| `ALLOWED_SITE` | The exact origin(s) your frontend runs on (e.g. `https://myapp.com`) | Only your site can use the proxy. Everything else gets `403 Origin is not allowed`. |
| `ALLOWED_TARGET` | The specific API host(s) (+ optional path patterns) your frontend talks to (e.g. `api.example.com` or `archive.org/*/__ia_thumb`) | The proxy will only forward requests to matching hosts and paths. Everything else gets `403 Target is not allowed`. |
| `REMOVE_HEADERS` | `cookie,authorization` | Strip credentials from the proxied request so the proxy can't be used to forward auth tokens to arbitrary targets. |

**This prevents the three worst-case scenarios:**

1. **Other sites hotlinking your proxy** – `ALLOWED_SITE` ensures only your frontend's origin can make requests.
2. **Proxy being used to hit arbitrary hosts** – `ALLOWED_TARGET` restricts which servers the proxy can talk to, preventing SSRF-like abuse.
3. **Accidental credential forwarding** – `REMOVE_HEADERS` strips `Cookie` and `Authorization` so even if a malicious page tricks a user into making a request, their login tokens aren't forwarded.

**Additional built-in protection:**  
SSRF (Server-Side Request Forgery) attacks are blocked automatically – requests to private IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), internal hostnames (`localhost`, `*.local`, `*.internal`), and IPv6 loopback/link-local addresses are rejected with a `403`.

> [!TIP]  
> **Need for auto-required Origin?** see [Allowed / Blacklisted Sites](#allowed--blacklisted-sites) for details.

---

### Allowed / Blacklisted Sites

`ALLOWED_SITE` and `BLACKLIST_SITE` match against the **hostname only** – scheme (`http`/`https`), port, and path are **ignored**.

`ALLOWED_TARGET` uses the same hostname matching plus optional path patterns (see below).

**Hostname rules (all three lists):**

- You can write entries as plain hostnames (`example.com`) or full URLs (`https://example.com`) – the proxy extracts the hostname either way.
- `https://example.com`, `http://example.com`, and `https://example.com:8080` all resolve to the same hostname: `example.com`.
- **Subdomains are distinct**:
   `example.com` does **not** match `api.example.com` or `www.example.com`. Add each subdomain explicitly if needed.
- **Wildcard subdomain matching** – use `*.` prefix to match any subdomain of a domain.  
   For example, `*.example.com` matches `api.example.com`, `www.example.com`, and `deep.sub.example.com`, but **not** `example.com` itself.  
   You must add `example.com` separately if you also want to allow the bare domain.
- **Safety validation**
   Wildcards targeting a public suffix (like `*.com`, `*.co.uk`, `*.s3.amazonaws.com`) are **automatically rejected** at config parse time using the [Public Suffix List](https://publicsuffix.org/).  
   This prevents accidentally allowing every `.com` domain or every `.co.uk` domain.
- All matching is **case-insensitive**, so `Example.COM` matches `example.com`.

<br/>

**Wildcard examples:**

| Entry | Matches | Does not match |
|-------|---------|----------------|
| `example.com` | `example.com` | `api.example.com`, `www.example.com` |
| `*.example.com` | `api.example.com`, `www.example.com`, `deep.sub.example.com` | `example.com`, `other.com` |
| `*.example.com, example.com` | `example.com`, `api.example.com`, `www.example.com` | `other.com` |
| `*.com` | ❌ **Rejected** (would match every `.com` domain) | – |
| `*.co.uk` | ❌ **Rejected** (would match every `.co.uk` domain) | – |
| `*.myapp.co.uk` | `sub.myapp.co.uk` | `myapp.co.uk`, `other.co.uk` |

<br/>

**Path patterns (`ALLOWED_TARGET` only):**

`ALLOWED_TARGET` additionally supports path-level restrictions with `*` wildcards and `|` pipe syntax. See the **[full ALLOWED_TARGET reference](./docs/allowed-target.md)** for details, formats, and URL examples.

<br/>

> [!IMPORTANT]  
> **Origin header is required when `ALLOWED_SITE` or `BLACKLIST_SITE` is configured.**
>
> The proxy **automatically** prepends `Origin` to `REQUIRE_HEADER` when either `ALLOWED_SITE` or `BLACKLIST_SITE` is non-empty. This ensures requests without an `Origin` header are always rejected when origin-based access control is active.
>
> Without this, non-CORS elements (`<img>`, `<script>`, `<link>`) could bypass the blacklist since browsers omit the `Origin` header on those requests.  
> The `Referer` header is **not** used as a fallback for origin detection – only the `Origin` header is trusted for access control decisions.

---

### Removed / Required Headers

**`REMOVE_HEADERS`**:   
Strips specified headers from the outbound request after all overrides are applied.  
This is a hard security boundary – `x-corsproxy-headers` cannot re-add a removed header.

**`REQUIRE_HEADER`**:  
Rejects requests that don't include specified headers.  
Useful for preventing casual browsing or ensuring clients declare their origin.

HTTP headers are [always case-insensitive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers) – `Origin` matches `origin`, `X-Requested-With` matches `x-requested-with`, etc.

---

### `MAX_BODY_SIZE`

Controls the maximum request body the proxy will forward (default: `10MB`). Set to `0` to allow any size (not recommended).

The unit is case-insensitive – `10MB`, `10mb`, `10Mb` all work the same.

Already pre-configured in `wrangler.jsonc` – you can override it in the dashboard if needed.

---

### Dev Mode

Dev mode bypasses **restrictions** (`ALLOWED_SITE`, `ALLOWED_TARGET`, `BLACKLIST_SITE`, `REQUIRE_HEADER`). Useful during development.

> [!WARNING]  
> `MAX_BODY_SIZE` and `REMOVE_HEADERS` are **not** bypassed by dev mode – they always apply for safety.

`DEV_PARAM` and `DEV_VALUE` can be set to anything you choose – they're not limited to `dev`/`secret`. Activation depends on three cases:

| `DEV_PARAM` | `DEV_VALUE` | How to activate |
|-------------|-------------|-----------------|
| Set to `debug` | Set to `let_me_in` | `?debug=let_me_in` (exact match required) |
| Set to `debug` | Empty / unset | `?debug=true`, `?debug`, or `?debug=anything` (any value works) |
| Empty / unset | – | Dev mode is **disabled** (always production) |

Examples:
```
# DEV_PARAM=dev, DEV_VALUE= (any value works)
https://cors-proxy.<your-subdomain>.workers.dev/?url=https://api.example.com&dev=true

# DEV_PARAM=admin, DEV_VALUE=secret (exact match required)
https://cors-proxy.<your-subdomain>.workers.dev/?url=https://api.example.com&admin=secret
```

> [!IMPORTANT]  
> Both `DEV_PARAM` and `DEV_VALUE` are **case-sensitive** – `?debug=let_me_in` won't activate if you set `DEV_PARAM=Debug` or pass `?DEBUG=let_me_in`.

> [!TIP]  
> [Playground](./src/pages/playground.ts) & [test](./src/pages/test.ts) page automatically forward the dev parameter from the page URL to proxy requests.  
> You only need to add `?dev=let_me_in` once in your browser.

<br/>

## 🐛 Troubleshooting

| Code | Message | Likely cause |
|------|---------|--------------|
| `403` | `"Origin is not allowed"` | Your origin isn't in `ALLOWED_SITE`. Add your site to `ALLOWED_SITE`. |
| `403` | `"Origin is not allowed"` when using `*.example.com` | The wildcard `*.example.com` does **not** match `example.com` itself. Add `example.com` separately if needed. |
| `403` | `"Origin is blacklisted"` | Your origin is in `BLACKLIST_SITE`. Contact the proxy admin to be removed. |
| `403` | `"Target is not allowed"` | The target host isn't in `ALLOWED_TARGET`. Add it to the list, or check your path patterns if using one. |
| `403` | `"Target is not allowed"` (private IP / internal hostname) | The target resolved to a private or internal IP address (`127.0.0.1`, `10.x.x.x`, `localhost`, etc.). SSRF protection blocked it. Use a public-facing URL instead. |
| `400` | `"Missing required header"` | The server requires a header (e.g., `Origin`) that your request doesn't include. Add the header or remove the `REQUIRE_HEADER` config. Note: `Origin` is auto-required when `ALLOWED_SITE` or `BLACKLIST_SITE` is configured – see [Allowed / Blacklisted Sites](#allowed--blacklisted-sites). |
| `400` | `"Invalid target URL"` when using `?url=ftp://...` or similar | The proxy only supports `http://` and `https://` targets. See [URL Formats](#url-formats) for details. |
| `413` | `"exceeds maximum allowed size"` | Your request body is larger than `MAX_BODY_SIZE`. Increase the limit or send a smaller payload. |
| `502` | `"Failed to fetch target"` | The target server is unreachable, DNS failed, or the connection was refused. Check the URL is correct and the target is online. |

| Symptom | Likely cause |
|---------|--------------|
| `Origin` header in the proxied request doesn't match what I sent | The proxy intentionally rewrites `Origin` to the target's origin to avoid triggering CORS on the target server. This is normal. |
| My custom header (`Cookie`, `Connection`, etc.) is missing from the proxied request | It may be in `REMOVE_HEADERS`, or it's a [hop-by-hop header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Connection) that the proxy strips automatically. Check `REMOVE_HEADERS` in your config. |
| `Set-Cookie` I set via `resHeaders` / `x-corsproxy-res-headers` isn't appearing in the response | `Set-Cookie` is blocked from response header overrides – see [Common Use Cases](#common-use-cases) for why. |
| The proxy isn't applying my `x-corsproxy-headers` | Make sure you're sending the header as a JSON string: `JSON.stringify({...})`. The value must be parseable JSON. |

<br/>

## ☁️ Cloudflare-Specific Notes

- **`keep_vars: true`**:  
   Prevents Wrangler from overwriting environment variables you set via the dashboard when you run `wrangler deploy`. Your dashboard values stay intact across deploys.  
   To change a variable, update it in the dashboard directly – local `wrangler.jsonc` changes won't override dashboard values while `keep_vars` is enabled.
- **All config is Text-type**:  
   Configuration variables are stored as **Text-type** environment variables (not **Secret** type), so you can always view and edit them in the dashboard after saving.

<br/>

## 📚 References

- [Cloudflare Workers CORS header proxy example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/)
- [Cloudflare Workers environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Workers supported protocols](https://developers.cloudflare.com/workers/reference/protocols/)
- [corsfix.com – Header Override docs](https://corsfix.com/docs/cors-proxy/header-override)
- [corsproxy.io – Header Rewrites docs](https://corsproxy.io/docs/header-rewrites/)
- [cors-anywhere by Rob--W](https://github.com/Rob--W/cors-anywhere)

## License

[GNU General Public License v3.0](./LICENSE)

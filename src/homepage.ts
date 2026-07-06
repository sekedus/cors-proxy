/**
 * Homepage rendering for the CORS proxy.
 * Reads README.md and renders it as HTML using github-markdown-css.
 */

import type { ProxyConfig } from './config';

// Client-side markdown rendering via Marked.js loaded from CDN, plus github-markdown-css.

/** Homepage template: pure rendered README */
const HOMEPAGE_HTML_TEMPLATE = (readmeContent: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CORS Proxy</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>
  body {
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .markdown-container {
    max-width: 900px;
    width: 100%;
    box-sizing: border-box;
  }
  .markdown-body pre code {
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body class="markdown-body">
<div id="readme-content" class="markdown-container"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.6/marked.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
  const readmeContent = ${JSON.stringify(readmeContent)};
  document.getElementById('readme-content').innerHTML = marked.parse(readmeContent);
</script>
</body>
</html>`;

/** /test page template: config summary + try-it demo */
const TEST_PAGE_HTML_TEMPLATE = (config: ProxyConfig, isDev: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CORS Proxy – Test</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>
  body {
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .markdown-container {
    max-width: 900px;
    width: 100%;
    box-sizing: border-box;
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    margin: 2px;
  }
  .badge-dev {
    background: var(--bgColor-attention-muted, #ddf4ff);
    color: var(--fgColor-accent, #0969da);
  }
  .badge-prod {
    background: var(--bgColor-success-muted, #dafbe1);
    color: var(--fgColor-success, #1a7f37);
  }
  .config-summary {
    background: var(--bgColor-muted, #f6f8fa);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
    font-size: 14px;
  }
  .config-summary h3 {
    margin-top: 0;
  }
  .config-summary code {
    background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2));
    padding: 2px 6px;
    border-radius: 3px;
  }
  .try-it {
    background: var(--bgColor-muted, #f6f8fa);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
  }
  .try-it input[type="url"] {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 8px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
  }
  .try-it button {
    padding: 8px 16px;
    background: var(--bgColor-success-emphasis, #2da44e);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }
  .try-it button:hover {
    filter: brightness(1.1);
  }
  .try-it pre {
    margin-top: 12px;
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
</head>
<body class="markdown-body">
  <div class="markdown-container">
    <p>
      ${isDev ? '<span class="badge badge-dev">🐞 Dev Mode</span>' : '<span class="badge badge-prod">🔒 Production</span>'}
      <a href="/">← Back to Home</a>
    </p>
    <div class="config-summary">
      <h3>⚙️ Server Configuration</h3>
      <ul>
        <li><strong>allowed_site:</strong> ${config.allowedSite.length ? config.allowedSite.join(', ') : '<em>any (all origins allowed)</em>'}</li>
        <li><strong>allowed_target:</strong> ${config.allowedTarget.length ? config.allowedTarget.join(', ') : '<em>any (all targets allowed)</em>'}</li>
        <li><strong>blacklist_site:</strong> ${config.blacklistSite.length ? config.blacklistSite.join(', ') : '<em>none</em>'}</li>
        <li><strong>remove_headers:</strong> ${config.removeHeaders.length ? config.removeHeaders.join(', ') : '<em>none</em>'}</li>
        <li><strong>require_header:</strong> ${config.requireHeader.length ? config.requireHeader.join(', ') : '<em>none</em>'}</li>
      </ul>
    </div>
    <div class="try-it">
      <h3>🚀 Try It</h3>
      <p>Enter a URL to fetch through the proxy:</p>
      <input type="url" id="target-url" placeholder="https://api.example.com/data" value="https://httpbin.org/anything">
      <br>
      <button onclick="tryProxy()">Fetch via Proxy</button>
      <pre id="try-result">Response will appear here...</pre>
    </div>
  </div>
<script>
  async function tryProxy() {
    const target = document.getElementById('target-url').value;
    const resultEl = document.getElementById('try-result');
    if (!target) { resultEl.textContent = 'Please enter a URL'; return; }
    resultEl.textContent = 'Fetching...';
    try {
      const proxyUrl = window.location.origin + '/' + target;
      const res = await fetch(proxyUrl);
      const text = await res.text();
      try {
        resultEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        resultEl.textContent = text;
      }
    } catch (err) {
      resultEl.textContent = 'Error: ' + err.message;
    }
  }
</script>
</body>
</html>`;

/**
 * Render the homepage (/) — pure rendered README using github-markdown-css.
 */
export async function renderHomepage(
	request: Request,
	_config: ProxyConfig,
	_isDev: boolean,
): Promise<Response> {
	let readmeContent = '';

	// Try to fetch README.md from the same origin (works with wrangler dev --assets)
	try {
		const readmeUrl = new URL(request.url);
		readmeUrl.pathname = '/README.md';
		const readmeResp = await fetch(readmeUrl.toString());
		if (readmeResp.ok) {
			readmeContent = await readmeResp.text();
		}
	} catch {
		readmeContent = getEmbeddedReadme();
	}

	if (!readmeContent) {
		readmeContent = getEmbeddedReadme();
	}

	const html = HOMEPAGE_HTML_TEMPLATE(readmeContent);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

/**
 * Render the /test page — config summary + try-it demo.
 */
export function renderTestPage(
	_config: ProxyConfig,
	isDev: boolean,
): Response {
	const html = TEST_PAGE_HTML_TEMPLATE(_config, isDev);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

/**
 * Embedded README content as fallback.
 */
function getEmbeddedReadme(): string {
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

Add \`dev=true\` to bypass all server restrictions:

\`\`\`
https://your-proxy.workers.dev/?url=https://api.example.com&dev=true
\`\`\`

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

### URL Schemes

- \`/\` — Homepage with this documentation
- \`/?url=<target>\` — Proxy with query param target
- \`/<protocol>://<host>/<path>\` — Proxy with path-based target
- \`/<host>/<path>\` — Proxy (defaults to https://)

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

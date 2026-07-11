/**
 * /test page – shows server configuration and interactive try-it demo.
 */

import { CSP_HEADER } from '../utils';
import type { ProxyConfig } from '../config';

const TEST_PAGE_HTML_TEMPLATE = (config: ProxyConfig, isDev: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CORS Proxy – Test</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
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
  .markdown-body pre,
  .markdown-body pre code {
    white-space: pre-line;
    word-break: break-word;
  }
  .nav-link {
    font-size: 14px;
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
    background: rgba(9,105,218,0.20);
    color: var(--fgColor-accent, #0969da);
  }
  .badge-prod {
    background: rgba(63,185,80,0.20);
    color: var(--fgColor-success, #1a7f37);
  }
  .config-summary {
    padding: 16px 0;
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
    outline: none;
  }
  .try-it input[type="url"]:focus {
    border-color: var(--borderColor-accent-emphasis, #0969da);
    box-shadow: 0 0 0 3px rgba(9,105,218,0.15);
  }
  .try-it button {
    padding: 8px 16px;
    background: var(--borderColor-success-emphasis, #1a7f37);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }
  .try-it button:hover {
    filter: brightness(1.1);
  }
  .try-it button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: none;
  }
  .try-it pre {
    margin-top: 16px;
    max-height: 400px;
    overflow: auto;
  }
  .no_items { display: none !important; }
</style>
</head>
<body class="markdown-body">
  <div class="markdown-container">
    <p class="nav-link">
      <a href="/">← Back to Home</a>
      &nbsp;|&nbsp;
      <a href="/playground">Playground</a>
    </p>
    <p>
      ${isDev ? '<span class="badge badge-dev">🐞 Dev Mode (' + config.devParam + ')</span>' : '<span class="badge badge-prod">🔒 Production</span>'}
    </p>
    ${isDev ? `<div class="config-summary">
      <h3>⚙️ Server Configuration</h3>
      <ul>
        <li><strong>allowed_site:</strong> ${config.allowedSite.length ? config.allowedSite.join(', ') : '<em>any (all origins allowed)</em>'}</li>
        <li><strong>allowed_target:</strong> ${config.allowedTarget.length ? config.allowedTarget.join(', ') : '<em>any (all targets allowed)</em>'}</li>
        <li><strong>blacklist_site:</strong> ${config.blacklistSite.length ? config.blacklistSite.join(', ') : '<em>none</em>'}</li>
        <li><strong>remove_headers:</strong> ${config.removeHeaders.length ? config.removeHeaders.join(', ') : '<em>none</em>'}</li>
        <li><strong>require_header:</strong> ${config.requireHeader.length ? config.requireHeader.join(', ') : '<em>none</em>'}</li>
      </ul>
    </div>` : ''}
    <div class="try-it">
      <h3>🚀 Try It</h3>
      <p>Enter a URL to fetch through the proxy:</p>
      <input type="url" id="target-url" placeholder="https://api.example.com/endpoint" value="https://web.archive.org">
      <br>
      <button onclick="tryProxy()">Fetch via Proxy</button>
      <pre id="try-result">Response will appear here...</pre>
    </div>
  </div>
<script>
  ${isDev ? `const DEV_PARAM = '${config.devParam}';
  const DEV_VALUE = '${config.devValue}';
  ` : ''}
  async function tryProxy() {
    const targetInput = document.getElementById('target-url');
    const target = targetInput.value;
    const resultEl = document.getElementById('try-result');
    if (!target) { resultEl.textContent = 'Please enter a URL'; return; }

    targetInput.disabled = true;
    const btn = document.querySelector('.try-it button');
    btn.disabled = true;
    resultEl.textContent = 'Fetching...';

    try {
      let proxyUrl = window.location.origin + '/' + target;
      ${isDev ? `// Forward dev mode if the current page URL has the dev param
      if (DEV_PARAM) {
        const currentParams = new URL(window.location.href).searchParams;
        const devValue = currentParams.get(DEV_PARAM);
        if (devValue !== null) {
          proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + DEV_PARAM + '=' + encodeURIComponent(devValue);
        }
      }
      ` : ''}
      const res = await fetch(proxyUrl);
      const text = await res.text();
      try {
        resultEl.textContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        resultEl.textContent = text;
      }
    } catch (err) {
      resultEl.textContent = 'Error: ' + err.message;
    } finally {
      targetInput.disabled = false;
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`;

/**
 * Render the /test page.
 */
export function renderTestPage(
	config: ProxyConfig,
	isDev: boolean,
): Response {
	const html = TEST_PAGE_HTML_TEMPLATE(config, isDev);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
			'Access-Control-Allow-Origin': '*',
			'Content-Security-Policy': CSP_HEADER,
		},
	});
}

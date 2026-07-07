/**
 * /playground page – full interactive CORS proxy sandbox.
 * Lets you configure method, headers, body, and dev mode, then inspect the full response.
 */

import type { ProxyConfig } from '../config';

const PLAYGROUND_HTML_TEMPLATE = (config: ProxyConfig, isDev: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CORS Proxy – Playground</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>
  body {
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .markdown-container {
    max-width: 960px;
    width: 100%;
    box-sizing: border-box;
  }
  .markdown-body pre,
  .markdown-body pre code {
    white-space: pre-line;
    word-break: break-word;
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
  .playground-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 700px) {
    .playground-grid { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--bgColor-muted, #f6f8fa);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    padding: 16px;
  }
  .panel h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
  }
  .panel label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin: 8px 0 4px;
  }
  .panel input,
  .panel select,
  .panel textarea {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    font-size: 13px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    box-sizing: border-box;
    outline: none;
  }
  .panel input:focus,
  .panel select:focus,
  .panel textarea:focus {
    border-color: var(--borderColor-accent-emphasis, #0969da);
    box-shadow: 0 0 0 3px rgba(9,105,218,0.15);
  }
  .panel textarea {
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    font-size: 12px;
    min-height: 60px;
    resize: vertical;
  }
  .header-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
    align-items: center;
  }
  .header-row input {
    flex: 1;
    padding: 4px 8px;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  }
  .header-row .hdr-name { max-width: 160px; }
  .header-row button {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    cursor: pointer;
  }
  .header-row button:hover { background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2)); }
  .add-header-btn {
    padding: 4px 12px;
    font-size: 12px;
    border: 1px dashed var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    background: transparent;
    color: var(--fgColor-muted, #59636e);
    cursor: pointer;
    margin-top: 4px;
  }
  .add-header-btn:hover {
    border-color: var(--borderColor-accent-emphasis, #0969da);
    color: var(--fgColor-accent, #0969da);
  }
  .options-row {
    display: flex;
    gap: 16px;
    align-items: center;
    margin: 8px 0;
    font-size: 13px;
  }
  .options-row label { margin: 0; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
  .options-row input[type="checkbox"] { width: auto; }
  .btn-primary {
    padding: 8px 24px;
    background: var(--borderColor-success-emphasis, #1a7f37);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover { filter: brightness(1.1); }
  .response-panel {
    margin-top: 16px;
  }
  .response-meta {
    font-size: 13px;
    margin-bottom: 8px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .response-meta .status-badge {
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 12px;
  }
  .status-2xx { background: rgba(63,185,80,0.2); color: var(--fgColor-success, #1a7f37); }
  .status-3xx { background: rgba(9,105,218,0.2); color: var(--fgColor-accent, #0969da); }
  .status-4xx { background: rgba(210,153,34,0.2); color: var(--fgColor-attention, #9a6700); }
  .status-5xx { background: rgba(248,81,73,0.2); color: var(--fgColor-danger, #d1242f); }
  .response-headers {
    max-height: 200px;
    overflow: auto;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bgColor-default, #fff);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 8px;
  }
  .response-body {
    max-height: 500px;
    overflow: auto;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--bgColor-default, #fff);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    padding: 8px;
  }
  .loading {
    opacity: 0.6;
    pointer-events: none;
  }
  .nav-link {
    font-size: 14px;
  }
  .config-info {
    font-size: 12px;
    color: var(--fgColor-muted, #59636e);
    margin-top: 16px;
    padding: 16px;
    background: var(--bgColor-default, #fff);
    border-radius: 4px;
    border: 1px solid var(--borderColor-default, #d0d7de);
  }
  .config-info code {
    background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2));
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 11px;
  }
  .config-info ul {
    margin: 10px 0 0;
  }
  .panel-subtitle {
    font-weight: 400;
    font-size: 11px;
    color: var(--fgColor-muted, #59636e);
  }
  .send-btn-wrapper { margin-top: 12px; }
  .meta-muted { font-size: 12px; color: var(--fgColor-muted, #59636e); }
  .no_items { display: none; }
</style>
</head>
<body class="markdown-body">
  <div class="markdown-container">
    <p class="nav-link">
      <a href="/">← Back to Home</a>
      &nbsp;|&nbsp;
      <a href="/test">Test Page</a>
    </p>
    <p>
      ${isDev ? '<span class="badge badge-dev">🐞 Dev Mode</span>' : '<span class="badge badge-prod">🔒 Production</span>'}
    </p>

    <h2>🧪 Playground</h2>
    <p>Configure your proxy request below and inspect the full response.</p>

    <div class="playground-grid">
      <!-- Left column -->
      <div>
        <div class="panel">
          <h3>🎯 Target</h3>
          <label for="target-url">URL</label>
          <input type="url" id="target-url" placeholder="https://api.example.com/endpoint" value="https://web.archive.org">

          <label for="http-method">Method</label>
          <select id="http-method">
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>

          <div id="body-section" class="no_items">
            <label for="request-body">Request Body</label>
            <textarea id="request-body" placeholder='{"key": "value"}'></textarea>
          </div>
        </div>

        <div class="panel">
          <h3>📤 Request Headers  <span class="panel-subtitle">(x-corsproxy-headers)</span></h3>
          <div id="req-headers-container"></div>
          <button class="add-header-btn" onclick="addReqHeader()">+ Add Request Header</button>
        </div>

        <div class="panel">
          <h3>📥 Response Headers  <span class="panel-subtitle">(x-corsproxy-res-headers)</span></h3>
          <div id="res-headers-container"></div>
          <button class="add-header-btn" onclick="addResHeader()">+ Add Response Header</button>
        </div>
      </div>

      <!-- Right column -->
      <div>
        <div class="panel">
          <h3>⚙️ Options</h3>
          <div class="options-row">
            <label>
              <input type="checkbox" id="dev-mode" ${isDev ? 'checked' : ''}>
              Dev Mode (bypass restrictions)
            </label>
            <label>
              <input type="checkbox" id="pretty-print" checked>
              Pretty-print JSON
            </label>
          </div>
          <div class="send-btn-wrapper">
            <button class="btn-primary" onclick="sendRequest()" id="send-btn">🚀 Send Request</button>
          </div>
        </div>

        <div class="config-info">
          <strong>Server config:</strong>
          <ul>
            <li><code>allowed_site</code>: ${config.allowedSite.length ? config.allowedSite.join(', ') : 'any'}</li>
            <li><code>allowed_target</code>: ${config.allowedTarget.length ? config.allowedTarget.join(', ') : 'any'}</li>
            <li><code>blacklist_site</code>: ${config.blacklistSite.length ? config.blacklistSite.join(', ') : 'none'}</li>
            <li><code>remove_headers</code>: ${config.removeHeaders.length ? config.removeHeaders.join(', ') : 'none'}</li>
            <li><code>require_header</code>: ${config.requireHeader.length ? config.requireHeader.join(', ') : 'none'}</li>
          </ul>
        </div>

        <div class="panel response-panel no_items" id="response-section">
          <h3>📬 Response</h3>
          <div class="response-meta" id="response-meta"></div>
          <div class="response-headers no_items" id="response-headers"></div>
          <div class="response-body" id="response-body">(empty)</div>
        </div>
      </div>
    </div>
  </div>

<script>
  // Header management
  let reqHeaderIdx = 0, resHeaderIdx = 0;

  function addReqHeader(name, value) {
    const c = document.getElementById('req-headers-container');
    const idx = ++reqHeaderIdx;
    const div = document.createElement('div');
    div.className = 'header-row';
    div.id = 'req-hdr-' + idx;
    div.innerHTML = '<input class="hdr-name" placeholder="Header" value="' + (name || '') + '">' +
      '<input placeholder="Value" value="' + (value || '') + '">' +
      '<button onclick="this.parentElement.remove()">✕</button>';
    c.appendChild(div);
  }

  function addResHeader(name, value) {
    const c = document.getElementById('res-headers-container');
    const idx = ++resHeaderIdx;
    const div = document.createElement('div');
    div.className = 'header-row';
    div.id = 'res-hdr-' + idx;
    div.innerHTML = '<input class="hdr-name" placeholder="Header" value="' + (name || '') + '">' +
      '<input placeholder="Value" value="' + (value || '') + '">' +
      '<button onclick="this.parentElement.remove()">✕</button>';
    c.appendChild(div);
  }

  // Method → body visibility
  document.getElementById('http-method').addEventListener('change', function() {
    document.getElementById('body-section').classList.toggle('no_items',
      !['POST', 'PUT', 'PATCH'].includes(this.value));
  });

  // Collect headers from container
  function collectHeaders(containerId) {
    const rows = document.getElementById(containerId).querySelectorAll('.header-row');
    const hdrs = {};
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const name = inputs[0].value.trim();
      const value = inputs[1].value;
      if (name) hdrs[name] = value;
    });
    return hdrs;
  }

  // Send request
  async function sendRequest() {
    const target = document.getElementById('target-url').value.trim();
    const method = document.getElementById('http-method').value;
    const devMode = document.getElementById('dev-mode').checked;
    const prettyPrint = document.getElementById('pretty-print').checked;
    const body = document.getElementById('request-body').value;
    const sendBtn = document.getElementById('send-btn');
    const responseSection = document.getElementById('response-section');
    const responseMeta = document.getElementById('response-meta');
    const responseHeaders = document.getElementById('response-headers');
    const responseBody = document.getElementById('response-body');

    if (!target) { alert('Please enter a target URL.'); return; }

    // Build proxy URL
    let proxyUrl = window.location.origin + '/' + target;
    const params = new URLSearchParams();

    if (devMode) params.set('dev', 'true');

    const reqHeaders = collectHeaders('req-headers-container');
    const resHeaders = collectHeaders('res-headers-container');

    if (Object.keys(reqHeaders).length > 0) {
      params.set('reqHeaders', Object.entries(reqHeaders).map(([k, v]) => k + ':' + v).join('&reqHeaders='));
    }
    if (Object.keys(resHeaders).length > 0) {
      params.set('resHeaders', Object.entries(resHeaders).map(([k, v]) => k + ':' + v).join('&resHeaders='));
    }

    const qs = params.toString();
    if (qs) proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + qs;

    // Prepare fetch options
    const fetchOpts = { method };
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      fetchOpts.headers = { 'Content-Type': 'application/json' };
      fetchOpts.body = body;
    }

    responseSection.classList.remove('no_items');
    responseMeta.innerHTML = '<em>Sending request...</em>';
    responseHeaders.classList.add('no_items');
    responseBody.textContent = '';
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Sending...';

    try {
      const startTime = performance.now();
      const res = await fetch(proxyUrl, fetchOpts);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const text = await res.text();

      // Status badge
      const statusClass = res.status < 300 ? 'status-2xx' : res.status < 400 ? 'status-3xx' : res.status < 500 ? 'status-4xx' : 'status-5xx';
      responseMeta.innerHTML = '<span class="status-badge ' + statusClass + '">' + res.status + ' ' + res.statusText + '</span>' +
        ' <span class="meta-muted">' + elapsed + 's</span>' +
        ' <span class="meta-muted">' + res.type + '</span>';

      // Response headers
      let hdrText = '';
      for (const [k, v] of res.headers.entries()) {
        hdrText += k + ': ' + v + '\\n';
      }
      responseHeaders.textContent = hdrText;
      responseHeaders.classList.remove('no_items');

      // Response body
      if (prettyPrint) {
        try {
          responseBody.textContent = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          responseBody.textContent = text;
        }
      } else {
        responseBody.textContent = text;
      }
    } catch (err) {
      responseMeta.innerHTML = '<span class="status-badge status-4xx">Error</span>';
      responseBody.textContent = 'Error: ' + err.message;
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = '🚀 Send Request';
    }
  }

  // Pre-populate with one example row
  addReqHeader('Authorization', 'Bearer my-token');
  addResHeader('X-Debug', 'true');
</script>
</body>
</html>`;

/**
 * Render the /playground page.
 */
export function renderPlaygroundPage(
	config: ProxyConfig,
	isDev: boolean,
): Response {
	const html = PLAYGROUND_HTML_TEMPLATE(config, isDev);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

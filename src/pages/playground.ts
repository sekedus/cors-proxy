/**
 * /playground page – full interactive CORS proxy sandbox.
 * Lets you configure method, headers, body, and dev mode, then inspect the full response.
 */

import { CSP_HEADER } from '../utils';
import type { ProxyConfig } from '../config';

const PLAYGROUND_HTML_TEMPLATE = (config: ProxyConfig, isDev: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CORS Proxy – Playground</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.6.1/github-markdown.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>
  * { box-sizing: border-box; }
  body {
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .markdown-container {
    max-width: 960px;
    width: 100%;
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
  .badge-sm {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
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
    outline: none;
  }
  .panel input:focus,
  .panel select:focus,
  .panel textarea:focus {
    border-color: var(--borderColor-accent-emphasis, #0969da);
    box-shadow: 0 0 0 3px rgba(9,105,218,0.15);
  }
  .panel-disabled {
    opacity: 0.5;
    pointer-events: none;
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
    line-height: 1;
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
    flex-wrap: wrap;
  }
  .options-row label {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
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
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    filter: none;
  }
  .send-btn-wrapper { margin-top: 12px; }
  .send-btn-wrapper .note {
    font-size: 11px;
    color: var(--fgColor-muted, #59636e);
    margin-top: 6px;
  }
  .response-panel { margin-top: 16px; }
  .response-meta {
    font-size: 13px;
    margin-bottom: 8px;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
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
  .response-body.empty {
    color: var(--fgColor-muted, #59636e);
    font-style: italic;
  }
  .proxy-url-box {
    background: var(--bgColor-default, #fff);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    margin-top: 16px;
    color: var(--fgColor-muted, #59636e);
  }
  .action-row {
    display: flex;
    gap: 8px;
    margin: 8px 0;
    flex-wrap: wrap;
  }
  .action-btn {
    padding: 4px 12px;
    font-size: 11px;
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 4px;
    background: var(--bgColor-default, #fff);
    color: var(--fgColor-default, #1f2328);
    cursor: pointer;
  }
  .action-btn:hover { background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2)); }
  .action-btn:active { transform: scale(0.97); }
  .action-btn.copy-ok {
    background: rgba(63,185,80,0.2);
    border-color: var(--borderColor-success-emphasis, #1a7f37);
    color: var(--fgColor-success, #1a7f37);
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--borderColor-default, #d0d7de);
    padding-bottom: 0;
  }
  .tab {
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    color: var(--fgColor-muted, #59636e);
    background: transparent;
    margin-bottom: -1px;
  }
  .tab:hover { color: var(--fgColor-default, #1f2328); }
  .tab.active {
    color: var(--fgColor-default, #1f2328);
    background: var(--bgColor-default, #fff);
    border-color: var(--borderColor-default, #d0d7de);
  }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
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
    padding-left: 20px;
  }
  .config-info li { margin: 2px 0; }
  .panel-subtitle {
    font-weight: 400;
    font-size: 11px;
    color: var(--fgColor-muted, #59636e);
  }
  .meta-muted { font-size: 12px; color: var(--fgColor-muted, #59636e); }
  .nav-link { font-size: 14px; }
  .mt-8 { margin-top: 8px; }
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bgColor-default, #fff);
    border: 1px solid var(--borderColor-default, #d0d7de);
    border-radius: 6px;
    padding: 8px 20px;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 100;
    opacity: 0;
    transition: opacity 0.25s;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
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
          <input type="url" id="target-url"
            placeholder="https://api.example.com/endpoint"
            value="https://web.archive.org"
            onkeydown="if(event.key==='Enter') sendRequest()">

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
            ${isDev ? `<label>
              <input type="checkbox" id="dev-mode" checked>
              Dev Mode <code>${config.devParam}</code> (bypass restrictions)
            </label>` : ''}
            <label>
              <input type="checkbox" id="pretty-print" checked>
              Pretty-print JSON
            </label>
            <label>
              <input type="checkbox" id="show-proxy-url" checked>
              Show proxy URL
            </label>
          </div>
          <div class="send-btn-wrapper">
            <button class="btn-primary" onclick="sendRequest()" id="send-btn">🚀 Send Request</button>
            <div class="note">Press <kbd>Enter</kbd> in URL field to send</div>
          </div>
          <div class="proxy-url-box no_items" id="proxy-url-box">
            <strong>Proxy URL:</strong>
            <div id="proxy-url-display"></div>
          </div>
        </div>

        ${isDev ? `<div class="config-info">
          <strong>Server config:</strong>
          <ul>
            <li><code>allowed_site</code>: ${config.allowedSite.length ? config.allowedSite.join(', ') : 'any'}</li>
            <li><code>allowed_target</code>: ${config.allowedTarget.length ? config.allowedTarget.join(', ') : 'any'}</li>
            <li><code>blacklist_site</code>: ${config.blacklistSite.length ? config.blacklistSite.join(', ') : 'none'}</li>
            <li><code>remove_headers</code>: ${config.removeHeaders.length ? config.removeHeaders.join(', ') : 'none'}</li>
            <li><code>require_header</code>: ${config.requireHeader.length ? config.requireHeader.join(', ') : 'none'}</li>
          </ul>
        </div>` : ''}

        <div class="panel response-panel no_items" id="response-section">
          <h3>📬 Response</h3>
          <div class="response-meta" id="response-meta"></div>
          <div id="response-content" class="no_items">
            <div class="tabs">
              <button class="tab active" data-tab="body-tab" onclick="switchTab('body-tab')">Body</button>
              <button class="tab" data-tab="headers-tab" onclick="switchTab('headers-tab')">Headers</button>
            </div>
            <div class="action-row">
              <button class="action-btn" onclick="copyResponse()" id="copy-btn">📋 Copy</button>
              <button class="action-btn" onclick="clearResponse()">🗑️ Clear</button>
              <span class="meta-muted" id="response-size"></span>
            </div>
            <div id="body-tab" class="tab-content active">
              <div class="response-body empty" id="response-body">(empty)</div>
            </div>
            <div id="headers-tab" class="tab-content">
              <div class="response-headers no_items" id="response-headers"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
  ${isDev ? `const DEV_PARAM = '${config.devParam}';
  const DEV_VALUE = '${config.devValue}';
  ` : ''}
  let reqHeaderIdx = 0, resHeaderIdx = 0;

  function addReqHeader(name, value) {
    const c = document.getElementById('req-headers-container');
    const idx = ++reqHeaderIdx;
    const div = document.createElement('div');
    div.className = 'header-row';
    div.id = 'req-hdr-' + idx;
    div.innerHTML =
      '<input class="hdr-name" placeholder="Header" value="' + esc(name || '') + '">' +
      '<input placeholder="Value" value="' + esc(value || '') + '">' +
      '<button onclick="this.parentElement.remove()">✕</button>';
    c.appendChild(div);
  }

  function addResHeader(name, value) {
    const c = document.getElementById('res-headers-container');
    const idx = ++resHeaderIdx;
    const div = document.createElement('div');
    div.className = 'header-row';
    div.id = 'res-hdr-' + idx;
    div.innerHTML =
      '<input class="hdr-name" placeholder="Header" value="' + esc(name || '') + '">' +
      '<input placeholder="Value" value="' + esc(value || '') + '">' +
      '<button onclick="this.parentElement.remove()">✕</button>';
    c.appendChild(div);
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.getElementById('http-method').addEventListener('change', function() {
    document.getElementById('body-section').classList.toggle('no_items',
      !['POST', 'PUT', 'PATCH'].includes(this.value));
  });

  document.getElementById('show-proxy-url').addEventListener('change', function() {
    if (this.checked) updateProxyUrlPreview();
    else document.getElementById('proxy-url-box').classList.add('no_items');
  });

  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }

  let toastTimer;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function copyResponse() {
    const bodyTab = document.getElementById('body-tab');
    const headersTab = document.getElementById('headers-tab');
    let text = '';
    if (bodyTab && bodyTab.classList.contains('active')) {
      text = document.getElementById('response-body').textContent;
    } else if (headersTab && headersTab.classList.contains('active')) {
      text = document.getElementById('response-headers').textContent;
    }
    if (!text || text === '(empty)' || text === 'Error' || text === '') return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = '✅ Copied!';
      btn.classList.add('copy-ok');
      setTimeout(() => { btn.textContent = '📋 Copy'; btn.classList.remove('copy-ok'); }, 2000);
    }).catch(() => showToast('Failed to copy'));
  }

  function setPanelsDisabled(disabled) {
    document.querySelectorAll('.panel:not(.response-panel)').forEach(function(el) {
      el.classList.toggle('panel-disabled', disabled);
    });
  }

  function clearResponse() {
    document.getElementById('response-section').classList.add('no_items');
    document.getElementById('response-content').classList.add('no_items');
    document.getElementById('response-body').textContent = '(empty)';
    document.getElementById('response-body').classList.add('empty');
    document.getElementById('response-headers').classList.add('no_items');
    document.getElementById('response-meta').innerHTML = '';
    document.getElementById('response-size').textContent = '';
  }

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

  function buildProxyUrl() {
    const target = document.getElementById('target-url').value.trim();
    if (!target) return '';
    const devMode = document.getElementById('dev-mode')?.checked;
    let proxyUrl = window.location.origin + '/' + target;
    const params = new URLSearchParams();
    ${isDev ? `if (devMode) params.set(DEV_PARAM, DEV_VALUE || 'true');
    ` : ''}
    const reqHeaders = collectHeaders('req-headers-container');
    const resHeaders = collectHeaders('res-headers-container');
    Object.entries(reqHeaders).forEach(([k, v]) => params.append('reqHeaders', k + ':' + v));
    Object.entries(resHeaders).forEach(([k, v]) => params.append('resHeaders', k + ':' + v));
    const qs = params.toString();
    if (qs) proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + qs;
    return proxyUrl;
  }

  function updateProxyUrlPreview() {
    const url = buildProxyUrl();
    if (url) {
      document.getElementById('proxy-url-display').textContent = url;
      document.getElementById('proxy-url-box').classList.remove('no_items');
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  async function sendRequest() {
    const target = document.getElementById('target-url').value.trim();
    const method = document.getElementById('http-method').value;
    const devMode = document.getElementById('dev-mode')?.checked;
    const prettyPrint = document.getElementById('pretty-print').checked;
    const body = document.getElementById('request-body').value;
    const sendBtn = document.getElementById('send-btn');
    const responseSection = document.getElementById('response-section');
    const responseMeta = document.getElementById('response-meta');
    const responseBody = document.getElementById('response-body');
    const responseSize = document.getElementById('response-size');

    if (!target) { showToast('Please enter a target URL.'); return; }

    let proxyUrl = window.location.origin + '/' + target;
    const params = new URLSearchParams();
    ${isDev ? `if (devMode) params.set(DEV_PARAM, DEV_VALUE || 'true');
    ` : ''}
    const reqHeaders = collectHeaders('req-headers-container');
    const resHeaders = collectHeaders('res-headers-container');
    Object.entries(reqHeaders).forEach(([k, v]) => params.append('reqHeaders', k + ':' + v));
    Object.entries(resHeaders).forEach(([k, v]) => params.append('resHeaders', k + ':' + v));
    const qs = params.toString();
    if (qs) proxyUrl += (proxyUrl.includes('?') ? '&' : '?') + qs;

    if (document.getElementById('show-proxy-url').checked) updateProxyUrlPreview();

    const fetchOpts = { method };
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      fetchOpts.headers = { 'Content-Type': 'application/json' };
      fetchOpts.body = body;
    }

    responseSection.classList.remove('no_items');
    document.getElementById('response-content').classList.add('no_items');
    responseMeta.innerHTML = '<span class="meta-muted">⏳ Sending request…</span>';
    responseBody.textContent = '';
    responseBody.classList.add('empty');
    responseSize.textContent = '';
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Sending…';
    setPanelsDisabled(true);

    try {
      const startTime = performance.now();
      const res = await fetch(proxyUrl, fetchOpts);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const text = await res.text();
      const size = new Blob([text]).size;

      const statusClass = res.status < 300 ? 'status-2xx'
        : res.status < 400 ? 'status-3xx'
        : res.status < 500 ? 'status-4xx'
        : 'status-5xx';

      const ct = res.headers.get('content-type') || '';
      const ctLabel = ct.includes('application/json') ? 'JSON'
        : ct.includes('text/html') ? 'HTML'
        : ct.includes('text/') ? 'Text'
        : ct.includes('image/') ? 'Image'
        : ct.includes('application/xml') || ct.includes('text/xml') ? 'XML'
        : ct || '–';

      responseMeta.innerHTML =
        '<span class="status-badge ' + statusClass + '">' + res.status + ' ' + res.statusText + '</span>' +
        ' <span class="meta-muted">' + elapsed + 's</span>' +
        ' <span class="badge-sm" style="background:var(--bgColor-neutral-muted,rgba(175,184,193,0.2))">' + esc(ctLabel) + '</span>';

      responseSize.textContent = formatSize(size);

      let hdrText = '';
      for (const [k, v] of res.headers.entries()) {
        hdrText += k + ': ' + v + '\\n';
      }
      document.getElementById('response-headers').textContent = hdrText;
      document.getElementById('response-headers').classList.remove('no_items');

      if (prettyPrint) {
        try {
          responseBody.textContent = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          responseBody.textContent = text;
        }
      } else {
        responseBody.textContent = text;
      }
      responseBody.classList.remove('empty');
      switchTab('body-tab');
      document.getElementById('response-content').classList.remove('no_items');
    } catch (err) {
      responseMeta.innerHTML = '<span class="status-badge status-4xx">Network Error</span>';
      responseBody.textContent = 'Error: ' + err.message + '\\n\\nMake sure the target URL is valid and the proxy can reach it.';
      responseBody.classList.remove('empty');
      document.getElementById('response-headers').classList.add('no_items');
      responseSize.textContent = '';
      document.getElementById('response-content').classList.remove('no_items');
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = '🚀 Send Request';
      setPanelsDisabled(false);
    }
  }

  addReqHeader('Referer', 'https://web.archive.org/');
  addResHeader('Content-Type', 'application/json');
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
			'Content-Security-Policy': CSP_HEADER,
		},
	});
}

/**
 * Homepage page – renders the README using github-markdown-css + Marked.js.
 */

import { CSP_HEADER } from '../utils';
import { getEmbeddedReadme } from './readme';

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
  .markdown-body pre,
  .markdown-body pre code {
    white-space: pre-line;
    word-break: break-word;
  }
  .nav-link { font-size: 14px; }
</style>
</head>
<body class="markdown-body">
<div class="markdown-container">
  <p class="nav-link">
    <a href="/test">Test</a>
    &nbsp;|&nbsp;
    <a href="/playground">Playground</a>
  </p>
  <div id="readme-content"></div>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.6/marked.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script src="https://cdn.jsdelivr.net/npm/marked-alert@2.1.2/dist/index.umd.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
  const readmeContent = ${JSON.stringify(readmeContent)};
  marked.use(markedAlert());
  document.getElementById('readme-content').innerHTML = marked.parse(readmeContent);
</script>
</body>
</html>`;

/**
 * Render the homepage (/) using embedded README content.
 * Avoids a self-fetch loop by using the bundled fallback directly.
 */
export function renderHomepage(): Response {
	const readmeContent = getEmbeddedReadme();
	const html = HOMEPAGE_HTML_TEMPLATE(readmeContent);
	return new Response(html, {
		headers: {
			'Content-Type': 'text/html;charset=UTF-8',
			'Access-Control-Allow-Origin': '*',
			'Content-Security-Policy': CSP_HEADER,
		},
	});
}

/**
 * Homepage page — renders the README using github-markdown-css + Marked.js.
 */

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

/**
 * Render the homepage (/).
 */
export async function renderHomepage(
	request: Request,
): Promise<Response> {
	let readmeContent = '';

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

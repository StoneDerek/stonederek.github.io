import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

// Export the actual production build, keeping the preview and website identical.
// Run after `npm run build`. The result opens directly without a local server.
let html = await readFile('dist/index.html', 'utf8');
const mime = { webp: 'image/webp', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
const embedded = new Map();
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:webp|svg|png|jpg))"/g)) {
  const path = match[1];
  const publicPath = path.match(/\/(art|thumbnails)\/.+$/)?.[0].slice(1) || path.match(/favicon\.svg$/)?.[0];
  if (!publicPath) throw new Error(`Cannot locate preview asset: ${path}`);
  const bytes = await readFile(resolve('public', publicPath));
  const extension = publicPath.split('.').pop();
  embedded.set(path, `data:${mime[extension]};base64,${bytes.toString('base64')}`);
}
for (const [path, uri] of embedded) html = html.replaceAll(`="${path}"`, `="${uri}"`);

// Astro may inline small bundles or emit a separate script; support both.
const scriptTags = [...html.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*?)><\/script>/g)];
for (const match of scriptTags) {
  const relative = match[2].match(/\/_astro\/.+$/)?.[0].slice(1);
  if (!relative) throw new Error(`Cannot locate preview script: ${match[2]}`);
  const script = await readFile(resolve('dist', relative), 'utf8');
  if (/\bimport\s*(?:\(|["'{*])/.test(script)) throw new Error('Preview bundle contains imports; inline dependencies before exporting.');
  html = html.replace(match[0], `<script${match[1]}${match[3]}>${script.replaceAll('</script', '<\\/script')}</script>`);
}

// The bundled gallery has no imports. A classic script also works in viewers
// that allow JavaScript but do not start module scripts for local HTML files.
html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (tag, attributes, script) => {
  const moduleType = /\s+type\s*=\s*(["'])module\1/i;
  if (!moduleType.test(attributes)) return tag;
  // Reject module-only syntax rather than exporting a silently broken preview.
  const classic = `(function () {\n"use strict";\n${script}\n})();`;
  new Script(classic, { filename: 'portfolio-preview.html' });
  return `<script${attributes.replace(moduleType, '')}>${classic}</script>`;
});

// File viewers can display HTML while blocking its scripts. Keep this message
// visible until the gallery has actually finished initializing. Preview only.
html = html.replace('</head>', `<style>
.preview-help { position: absolute; z-index: 8; bottom: max(12px, env(safe-area-inset-bottom)); left: 12px; right: 12px; max-width: 420px; margin-inline: auto; padding: 14px 16px; border-radius: 6px; background: #fff; color: #191919; font-size: 13px; line-height: 1.45; }
.portfolio[data-ready="true"] .preview-help { display: none; }
</style></head>`);
html = html.replace(/(<main\b[^>]*\bid="portfolio"[^>]*>)/, '$1<aside class="preview-help" role="status">Gallery controls have not started in this viewer. Try opening the preview in a browser.</aside>');
html = html.replace(/(<a class="wordmark" href=")[^"]*(")/, '$1#$2');
// Keep the résumé route usable in the single-file preview. A small document
// blob opens the actual generated page; the production link remains /resume/.
if (html.includes('data-resume-link')) {
  let resume = await readFile('dist/resume/index.html', 'utf8');
  resume = resume.replace(/(<a\b[^>]*\bdata-resume-home\b[^>]*\bhref=")[^"]*(")/, '$1__PORTFOLIO_PREVIEW_HOME__$2');
  for (const [path, uri] of embedded) resume = resume.replaceAll(`="${path}"`, `="${uri}"`);
  const markup = JSON.stringify(resume).replaceAll('<', '\\u003c');
  const previewRoute = `(function () {
    const link = document.querySelector('[data-resume-link]');
    if (!link) return;
    const home = location.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const page = ${markup}.replace('__PORTFOLIO_PREVIEW_HOME__', home);
    const address = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    link.href = address;
    window.addEventListener('pagehide', event => { if (!event.persisted) URL.revokeObjectURL(address); });
  })();`;
  new Script(previewRoute, { filename: 'resume-preview-route.js' });
  html = html.replace('</body>', `<script>${previewRoute}</script></body>`);
}
await writeFile('portfolio-preview.html', html);
console.log(`Exported portfolio-preview.html (${Math.round(Buffer.byteLength(html) / 1024)} KB).`);

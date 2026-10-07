import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';

// Bundle the actual production pages into one offline, navigable review file.
// Each route runs in a fresh frame, so gallery event listeners never accumulate.
const routes = { home: 'index.html', about: 'about/index.html', projects: 'projects/index.html', resume: 'resume/index.html' };
const pages = {};
const assets = {};
const projectSlugs = JSON.parse(await readFile(resolve('src/data/projects.json'), 'utf8')).map(project => project.slug);
const embedded = new Map();
const resumePDF = await readFile(resolve('dist', 'resume.pdf')).then(bytes => bytes.toString('base64')).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
const mime = { webp: 'image/webp', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
for (const [route, file] of Object.entries(routes)) {
  let html = await readFile(resolve('dist', file), 'utf8');
  // srcdoc routes use the preview's message bridge instead of network fetching.
  html = html.replace(/<meta\b[^>]*name="astro-view-transitions-enabled"[^>]*>/g, '')
    .replace(/(<meta\b[^>]*name="astro-view-transitions-fallback"[^>]*content=")animate("[^>]*>)/g, '$1none$2');
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:webp|svg|png|jpg))"/g)) {
    const path = match[1];
    const publicPath = path.match(/\/(art|thumbnails)\/.+$/)?.[0].slice(1) || path.match(/favicon\.svg$/)?.[0];
    if (!publicPath) throw new Error(`Cannot locate preview asset: ${path}`);
    if (!embedded.has(path)) {
      const token = `__PORTFOLIO_ASSET_${embedded.size}__`;
      const bytes = await readFile(resolve('public', publicPath));
      assets[token] = `data:${mime[publicPath.split('.').pop()]};base64,${bytes.toString('base64')}`;
      embedded.set(path, token);
    }
  }
  for (const [path, token] of embedded) html = html.replaceAll(`="${path}"`, `="${token}"`);
  for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
    const relative = match[1].match(/\/_astro\/.+$/)?.[0].slice(1);
    if (!relative) throw new Error(`Cannot locate preview stylesheet: ${match[1]}`);
    html = html.replace(match[0], `<style>${await readFile(resolve('dist', relative), 'utf8')}</style>`);
  }
  for (const match of [...html.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*?)><\/script>/g)]) {
    const relative = match[2].match(/\/_astro\/.+$/)?.[0].slice(1);
    if (!relative) throw new Error(`Cannot locate preview script: ${match[2]}`);
    const result = await build({ entryPoints: [resolve('dist', relative)], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, logLevel: 'silent' });
    const script = result.outputFiles[0].text;
    const classic = `(function(){function start(){${script}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start,{once:true})}else{start()}})();`;
    new Script(classic, { filename: `preview-${route}.js` });
    // A function replacement keeps minified $&, $` and $' sequences literal.
    html = html.replace(match[0], () => `<script>${classic.replaceAll('</script', '<\\/script')}</script>`);
  }
  // Validate the inserted bytes too, not only the bundle before substitution.
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('application/json')) continue;
    new Script(match[2], { filename: `embedded-preview-${route}.js` });
  }
  pages[route] = html;
}

function initializePreview({ pages, assets, resumePDF, projectSlugs }) {
  const frame = document.querySelector('iframe');
  const favicon = document.createElement('link');
  favicon.rel = 'icon'; favicon.type = 'image/svg+xml'; document.head.append(favicon);
  const expanded = route => {
    let html = pages[route];
    for (const [token, value] of Object.entries(assets)) html = html.replaceAll(token, value);
    return html;
  };
  const escapeScript = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const home = `${location.href.split('#')[0]}#home`.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const pdfAddress = resumePDF ? URL.createObjectURL(new Blob([Uint8Array.from(atob(resumePDF), char => char.charCodeAt(0))], { type: 'application/pdf' })) : null;
  let resume = expanded('resume').replace(/(<a\b[^>]*\bdata-resume-home\b[^>]*\bhref=")[^"]*(")/, `$1${home}$2`);
  if (pdfAddress) resume = resume.replace(/(<a\b[^>]*\bdata-resume-pdf\b[^>]*\bhref=")[^"]*(")/, `$1${pdfAddress}$2`);
  const resumeAddress = pdfAddress || URL.createObjectURL(new Blob([resume], { type: 'text/html' }));
  let previousRoute = null;
  let pendingHandoff = false;
  let renderGeneration = 0;
  const render = async () => {
    const generation = ++renderGeneration;
    const [requested, fragment = ''] = location.hash.slice(1).split('?');
    const route = ['home', 'about', 'projects'].includes(requested) ? requested : 'home';
    document.title = route === 'home' ? 'Derek Stone — Portfolio preview' : `Derek Stone — ${route === 'about' ? 'About' : 'Projects'} preview`;
    let html = expanded(route);
    const order = ['home', 'about', 'projects'];
    const direction = previousRoute && !pendingHandoff ? Math.sign(order.indexOf(route) - order.indexOf(previousRoute)) : 0;
    const projectEntry = direction && route === 'projects' && projectSlugs.includes(new URLSearchParams(fragment).get('project'));
    pendingHandoff = false;
    if (direction) await frame.contentWindow?.__PORTFOLIO_PREVIEW_EXIT__?.();
    if (generation !== renderGeneration) return;
    previousRoute = route;
    if (projectEntry) html = html.replace(/<main\b([^>]*\bid="portfolio"[^>]*)>/, '<main$1 data-section-project-entry>');
    const setup = `<script>document.startViewTransition=undefined;window.__PORTFOLIO_PREVIEW_FRAGMENT__=${escapeScript(fragment ? `#${fragment}` : '')};window.__PORTFOLIO_PREVIEW_DIRECTION__=${direction};window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__=${Boolean(projectEntry)};window.__PORTFOLIO_PREVIEW_NAVIGATE__=function(route,options){window.parent.postMessage({type:'portfolio-preview-route',route,fragment:options?.fragment||'',gallerySwipe:!!options?.gallerySwipe,replace:!!options?.replace},'*')};<\/script>`;
    html = html.replace('<head>', `<head><base href="about:srcdoc">${setup}`);
    html = html.replace(/(<a\b[^>]*\bdata-resume-link\b[^>]*\bhref=")[^"]*(")/, `$1${resumeAddress}$2`);
    // Attributes can appear in either order in compiler output.
    html = html.replace(/(<a\b[^>]*\bhref=")[^"]*("[^>]*\bdata-resume-link\b)/g, `$1${resumeAddress}$2`);
    const navigation = `<script>document.addEventListener('click',function(event){
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=event.target.closest('a[data-site-route]');if(!link)return;
      event.preventDefault();const fragment=link.getAttribute('href').split('#')[1]||'';
      window.parent.postMessage({type:'portfolio-preview-route',route:link.dataset.siteRoute,fragment},'*');
    });const icon=document.querySelector('[data-project-favicon]');
    const syncIcon=function(){if(icon)window.parent.postMessage({type:'portfolio-preview-favicon',href:icon.href},'*')};
    if(icon)new MutationObserver(syncIcon).observe(icon,{attributes:true,attributeFilter:['href']});syncIcon();
    document.addEventListener('DOMContentLoaded',function(){
      const id=window.__PORTFOLIO_PREVIEW_FRAGMENT__.slice(1);
      if(id&&!id.startsWith('project='))document.getElementById(decodeURIComponent(id))?.scrollIntoView();
    });<\/script>`;
    frame.srcdoc = html.replace('</body>', `${navigation}</body>`);
  };
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'portfolio-preview-route' && ['home', 'about', 'projects'].includes(event.data.route)) {
      pendingHandoff = Boolean(event.data.gallerySwipe);
      const hash = `#${event.data.route}${event.data.fragment ? `?${event.data.fragment}` : ''}`;
      if (event.data.replace) { history.replaceState(history.state, '', hash); render(); }
      else location.hash = hash;
    }
    if (event.data?.type === 'portfolio-preview-favicon' && typeof event.data.href === 'string' && event.data.href.startsWith('data:image/')) {
      favicon.href = event.data.href;
    }
    if (event.data?.type === 'portfolio-preview-fragment') {
      history.replaceState(null, '', `#projects${event.data.fragment ? `?${event.data.fragment.slice(1)}` : ''}`);
    }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {
      URL.revokeObjectURL(resumeAddress);
      if (pdfAddress && pdfAddress !== resumeAddress) URL.revokeObjectURL(pdfAddress);
    }
  });
  render();
}
const payload = JSON.stringify({ pages, assets, resumePDF, projectSlugs }).replaceAll('<', '\\u003c');
const loader = `(${initializePreview.toString()})(JSON.parse(document.getElementById('preview-data').textContent));`;
new Script(loader, { filename: 'preview-navigation.js' });
const output = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Derek Stone — Portfolio preview</title><style>html,body{margin:0;width:100%;height:100%;background:#fff}iframe{display:block;width:100%;height:100%;border:0}noscript{padding:24px;font:16px/1.5 Arial,sans-serif}</style></head><body><iframe title="Derek Stone’s portfolio"></iframe><noscript>Open this preview in a browser with JavaScript enabled to explore Home, About, and Projects.</noscript><script type="application/json" id="preview-data">${payload}</script><script>${loader}</script></body></html>`;
await writeFile('portfolio-preview.html', output);
console.log(`Exported all three portfolio pages (${Math.round(Buffer.byteLength(output) / 1024)} KB).`);

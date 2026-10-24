import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { initializeTheme, themeStorageKey, appearanceEnabled } from '../src/scripts/theme.js';
import { previewAddress, previewHash } from '../src/scripts/gallery-location.js';

// Bundle the actual production pages into one offline, navigable review file.
// One persistent frame uses the same gallery navigation as the production app.
const routes = { home: 'index.html', about: 'about/index.html', projects: 'projects/index.html', resume: 'resume/index.html' };
const pages = {};
const assets = {};
const embedded = new Map();
const resources = new Map();
const embedResource = (path, content) => {
  const token = `__PORTFOLIO_RESOURCE_${resources.size}__`;
  resources.set(path, token); assets[token] = content;
  return token;
};
const resumePDF = await readFile(resolve('dist', 'resume.pdf')).then(bytes => bytes.toString('base64')).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
const mime = { webp: 'image/webp', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
const imageTokens = new Map();
async function embedImage(path, publicPath) {
  if (embedded.has(path)) return embedded.get(path);
  let token = imageTokens.get(publicPath);
  if (!token) {
    const filename = resolve('public', publicPath);
    if (!filename.startsWith(resolve('public') + '/')) throw new Error(`Preview image is outside public/: ${publicPath}`);
    const type = mime[publicPath.split('.').pop().toLowerCase()];
    if (!type) throw new Error(`Unsupported preview image: ${publicPath}`);
    const bytes = await readFile(filename);
    token = `__PORTFOLIO_ASSET_${imageTokens.size}__`;
    assets[token] = `data:${type};base64,${bytes.toString('base64')}`;
    imageTokens.set(publicPath, token);
  }
  embedded.set(path, token);
  return token;
}
for (const [route, file] of Object.entries(routes)) {
  let html = await readFile(resolve('dist', file), 'utf8');
  // srcdoc routes use the preview's message bridge instead of network fetching.
  html = html.replace(/<meta\b[^>]*name="astro-view-transitions-enabled"[^>]*>/g, '')
    .replace(/(<meta\b[^>]*name="astro-view-transitions-fallback"[^>]*content=")(?:animate|swap)("[^>]*>)/g, '$1none$2');
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:webp|svg|png|jpg))"/g)) {
    const path = match[1];
    const publicPath = path.match(/\/(art|thumbnails)\/.+$/)?.[0].slice(1) || path.match(/favicon\.svg$/)?.[0];
    if (!publicPath) throw new Error(`Cannot locate preview asset: ${path}`);
    await embedImage(path, publicPath);
  }
  for (const [path, token] of embedded) html = html.replaceAll(`="${path}"`, `="${token}"`);
  if (html.includes('id="portfolio-data"')) {
    const data = html.match(/<script\b[^>]*\bid="portfolio-data"[^>]*>([\s\S]*?)<\/script>/);
    const projects = JSON.parse(data[1]);
    const base = html.match(/\bdata-asset-base="([^"]*)"/)?.[1] || '/';
    for (const project of projects) {
      const media = [...(project.articleMedia || []), ...(project.caseStudy?.sections || []).flatMap(section => section.media || [])];
      for (const item of media) {
        if (!item.src || /^(https?:\/\/|\/\/|data:)/.test(item.src)) continue;
        const publicPath = item.src.startsWith(base) ? item.src.slice(base.length) : item.src.replace(/^\//, '');
        item.src = await embedImage(`${base}${publicPath}`, publicPath);
      }
    }
    html = html.replace(data[0], () => data[0].replace(data[1], () => JSON.stringify(projects).replace(/</g, '\\u003c')));
  }
  for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g)]) {
    const relative = match[1].match(/\/_astro\/.+$/)?.[0].slice(1);
    if (!relative) throw new Error(`Cannot locate preview stylesheet: ${match[1]}`);
    const token = resources.get(relative) || embedResource(relative, await readFile(resolve('dist', relative), 'utf8'));
    html = html.replace(match[0], () => `<style>${token}</style>`);
  }
  for (const match of [...html.matchAll(/<script\b([^>]*?)\bsrc="([^"]+)"([^>]*?)><\/script>/g)]) {
    const relative = match[2].match(/\/_astro\/.+$/)?.[0].slice(1);
    if (!relative) throw new Error(`Cannot locate preview script: ${match[2]}`);
    let token = resources.get(relative);
    if (!token) {
      const result = await build({ entryPoints: [resolve('dist', relative)], bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, logLevel: 'silent' });
      const script = result.outputFiles[0].text;
      const classic = `(function(){function start(){${script}}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start,{once:true})}else{start()}})();`;
      new Script(classic, { filename: `preview-${route}.js` });
      token = embedResource(relative, classic.replaceAll('</script', '<\\/script'));
    }
    html = html.replace(match[0], () => `<script>${token}</script>`);
  }
  // Validate the inserted bytes too, not only the bundle before substitution.
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (match[1].includes('application/json')) continue;
    new Script(assets[match[2]] ?? match[2], { filename: `embedded-preview-${route}.js` });
  }
  pages[route] = html;
}

function initializePreview({ pages, assets, resumePDF }, addressFromHash, hashFromAddress) {
  const frame = document.querySelector('iframe');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let themeChoice = window.__PORTFOLIO_THEME_STATE__?.choice || 'system';
  let currentAddress = addressFromHash(location.hash);
  const expanded = route => {
    let html = pages[route];
    for (const [token, value] of Object.entries(assets)) html = html.replaceAll(token, () => value);
    return html;
  };
  const escapeScript = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  const home = `${location.href.split('#')[0]}#home`.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const pdfAddress = resumePDF ? URL.createObjectURL(new Blob([Uint8Array.from(atob(resumePDF), char => char.charCodeAt(0))], { type: 'application/pdf' })) : null;
  let resume = expanded('resume').replace(/(<a\b[^>]*\bdata-resume-home\b[^>]*\bhref=")[^"]*(")/, `$1${home}$2`);
  if (pdfAddress) resume = resume.replace(/(<a\b[^>]*\bdata-resume-pdf\b[^>]*\bhref=")[^"]*(")/, `$1${pdfAddress}$2`);
  const resumeAddress = pdfAddress || URL.createObjectURL(new Blob([resume], { type: 'text/html' }));
  const route = new URL(currentAddress, 'https://portfolio.invalid').pathname.split('/')[1] || 'home';
  let html = expanded(route);
  const setup = `<script>window.__PORTFOLIO_PREVIEW_ADDRESS__=${escapeScript(currentAddress)};window.__PORTFOLIO_PREVIEW_THEME_CHOICE__=${escapeScript(themeChoice)};window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__=${preference.matches};window.addEventListener('message',function(event){if(event.source===window.parent&&event.data?.type==='portfolio-preview-system-theme'){window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__=!!event.data.dark;document.dispatchEvent(new Event('portfolio:preview-system-change'))}});window.__PORTFOLIO_PREVIEW_SET_THEME__=function(state){window.parent.postMessage({type:'portfolio-preview-theme',choice:state.choice,resolved:state.resolved},'*')};<\/script>`;
  html = html.replace('<head>', `<head><base href="about:srcdoc">${setup}`);
  html = html.replace(/(<a\b[^>]*\bdata-resume-link\b[^>]*\bhref=")[^"]*("[^>]*>)/g, `$1${resumeAddress}$2`)
    .replace(/(<a\b[^>]*\bhref=")[^"]*("[^>]*\bdata-resume-link\b)/g, `$1${resumeAddress}$2`);
  const synchronize = `<script>const title=document.querySelector('title');const sync=function(){window.parent.postMessage({type:'portfolio-preview-title',title:document.title},'*')};if(title)new MutationObserver(sync).observe(title,{childList:true,subtree:true,characterData:true});sync();<\/script>`;
  html = html.replace('</body>', `${synchronize}</body>`);
  // Load the app once. Every section, project, and Back/Forward change stays in
  // this same frame, using the production gallery controller.
  frame.srcdoc = html;
  const followHistory = () => {
    const address = addressFromHash(location.hash);
    if (address === currentAddress) return;
    currentAddress = address;
    frame.contentWindow.postMessage({ type: 'portfolio-preview-navigate', address }, '*');
  };
  frame.addEventListener('load', () => {
    // An address change before the child mounted may have arrived too early.
    // Always synchronize the latest address once that single frame is ready.
    currentAddress = addressFromHash(location.hash);
    frame.contentWindow.postMessage({ type: 'portfolio-preview-navigate', address: currentAddress }, '*');
  }, { once: true });
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.type === 'portfolio-preview-address' && typeof data.address === 'string' && data.address.startsWith('/') && !data.address.startsWith('//')) {
      currentAddress = data.address;
      const hash = hashFromAddress(currentAddress);
      if (location.hash !== hash) history[data.replace ? 'replaceState' : 'pushState'](null, '', hash);
    }
    if (data?.type === 'portfolio-preview-title' && typeof data.title === 'string') document.title = data.title + ' - Preview';
    if (data?.type === 'portfolio-preview-theme' && ['system', 'light', 'dark'].includes(data.choice)) {
      themeChoice = data.choice;
      document.documentElement.dataset.theme = data.resolved === 'dark' ? 'dark' : 'light';
      window.__PORTFOLIO_THEME_STATE__ = { choice: themeChoice, resolved: document.documentElement.dataset.theme };
    }
  });
  preference.addEventListener('change', () => {
    frame.contentWindow?.postMessage({ type: 'portfolio-preview-system-theme', dark: preference.matches }, '*');
  });
  window.addEventListener('popstate', followHistory);
  window.addEventListener('hashchange', followHistory);
  window.addEventListener('pagehide', event => {
    if (!event.persisted) {
      URL.revokeObjectURL(resumeAddress);
      if (pdfAddress) URL.revokeObjectURL(pdfAddress);
    }
  });
}
const favicon = assets[await embedImage('/favicon.svg', 'favicon.svg')];
const payload = JSON.stringify({ pages, assets, resumePDF }).replaceAll('<', '\\u003c');
const loader = `(${initializePreview.toString()})(JSON.parse(document.getElementById('preview-data').textContent),${previewAddress.toString()},${previewHash.toString()});`;
new Script(loader, { filename: 'preview-navigation.js' });
const startup = `(${initializeTheme.toString()})(${JSON.stringify(themeStorageKey)},${appearanceEnabled});`;
new Script(startup, { filename: 'preview-theme-startup.js' });
const output = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Derek Stone - Portfolio preview</title><link rel="icon" type="image/svg+xml" href="${favicon}"><style>html,body{margin:0;width:100%;height:100%}html{background:#fff;color-scheme:light}html[data-theme="dark"]{background:#17171b;color-scheme:dark}iframe{display:block;width:100%;height:100%;border:0}noscript{padding:24px;font:16px/1.5 Arial,sans-serif}</style><script>${startup}</script></head><body><iframe title="Derek Stone’s portfolio"></iframe><noscript>Open this preview in a browser with JavaScript enabled to explore Home, About, and Projects.</noscript><script type="application/json" id="preview-data">${payload}</script><script>${loader}</script></body></html>`;
await writeFile('portfolio-preview.html', output);
console.log(`Exported all three portfolio pages (${Math.round(Buffer.byteLength(output) / 1024)} KB).`);

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import { initializeTheme } from '../src/scripts/theme.js';

// Bundle the actual production pages into one offline, navigable review file.
// Each route runs in a fresh frame, so gallery event listeners never accumulate.
const routes = { home: 'index.html', about: 'about/index.html', projects: 'projects/index.html', resume: 'resume/index.html' };
const pages = {};
const assets = {};
const projectSlugs = JSON.parse(await readFile(resolve('src/data/projects.json'), 'utf8')).map(project => project.slug);
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

function initializePreview({ pages, assets, resumePDF, projectSlugs }) {
  let themeChoice = window.__PORTFOLIO_THEME_STATE__?.choice || 'system';
  const systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
  systemPreference.addEventListener('change', () => {
    document.querySelectorAll('iframe').forEach(element => element.contentWindow?.postMessage({
      type: 'portfolio-preview-system-theme', dark: systemPreference.matches
    }, '*'));
  });
  let frame = document.querySelector('iframe');
  let cancelHandoff = () => {};
  const favicon = document.createElement('link');
  favicon.rel = 'icon'; favicon.type = 'image/svg+xml'; document.head.append(favicon);
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
  let previousRoute = null;
  let pendingHandoff = false;
  let renderGeneration = 0;
  const render = async () => {
    const generation = ++renderGeneration;
    cancelHandoff();
    const [requested, fragment = ''] = location.hash.slice(1).split('?');
    const route = ['home', 'about', 'projects'].includes(requested) ? requested : 'home';
    document.title = route === 'home' ? 'Derek Stone — Portfolio preview' : `Derek Stone — ${route === 'about' ? 'About' : 'Projects'} preview`;
    let html = expanded(route);
    const order = ['home', 'about', 'projects'];
    const handoff = pendingHandoff;
    const direction = previousRoute && !handoff ? Math.sign(order.indexOf(route) - order.indexOf(previousRoute)) : 0;
    const projectEntry = direction && route === 'projects' && projectSlugs.includes(new URLSearchParams(fragment).get('project'));
    pendingHandoff = false;
    if (direction) await frame.contentWindow?.__PORTFOLIO_PREVIEW_EXIT__?.();
    if (generation !== renderGeneration) return;
    const fromPalette = direction ? frame.contentWindow?.__PORTFOLIO_PREVIEW_PALETTE__?.() : null;
    previousRoute = route;
    if (projectEntry) html = html.replace(/<main\b([^>]*\bid="portfolio"[^>]*)>/, '<main$1 data-section-project-entry>');
    const setup = `<script>document.startViewTransition=undefined;window.__PORTFOLIO_PREVIEW_THEME_CHOICE__=${escapeScript(themeChoice)};window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__=${systemPreference.matches};window.addEventListener('message',function(event){if(event.source===window.parent&&event.data?.type==='portfolio-preview-system-theme'){window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__=!!event.data.dark;document.dispatchEvent(new Event('portfolio:preview-system-change'))}});window.__PORTFOLIO_PREVIEW_SET_THEME__=function(state){window.parent.postMessage({type:'portfolio-preview-theme',choice:state.choice,resolved:state.resolved},'*')};window.__PORTFOLIO_PREVIEW_FRAGMENT__=${escapeScript(fragment ? `#${fragment}` : '')};window.__PORTFOLIO_PREVIEW_DIRECTION__=${direction};window.__PORTFOLIO_PREVIEW_FROM_PALETTE__=${escapeScript(fromPalette)};window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__=${Boolean(projectEntry)};window.__PORTFOLIO_PREVIEW_NAVIGATE__=function(route,options){window.parent.postMessage({type:'portfolio-preview-route',route,fragment:options?.fragment||'',gallerySwipe:!!options?.gallerySwipe,replace:!!options?.replace},'*')};<\/script>`;
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
    html = html.replace('</body>', `${navigation}</body>`);
    if (!handoff) { frame.srcdoc = html; return; }
    // The gesture has already revealed About. Keep that painted page on top
    // until its replacement document is ready, rather than emptying the frame.
    const outgoing = frame, incoming = document.createElement('iframe');
    incoming.title = outgoing.title; incoming.dataset.staging = 'true';
    incoming.inert = true; incoming.setAttribute('aria-hidden', 'true');
    Object.assign(outgoing.style, { position: 'relative', zIndex: '1' });
    Object.assign(incoming.style, { position: 'absolute', inset: '0', zIndex: '0' });
    let paintFrame = 0;
    const cleanup = () => {
      incoming.remove(); cancelAnimationFrame(paintFrame); outgoing.removeAttribute('style'); cancelHandoff = () => {};
    };
    cancelHandoff = cleanup;
    incoming.addEventListener('load', () => {
      if (generation !== renderGeneration) return;
      paintFrame = requestAnimationFrame(() => {
        paintFrame = requestAnimationFrame(() => {
          if (generation !== renderGeneration) return;
          frame = incoming;
          delete incoming.dataset.staging; incoming.inert = false; incoming.removeAttribute('aria-hidden');
          incoming.removeAttribute('style'); outgoing.remove(); cancelHandoff = () => {};
          const icon = incoming.contentDocument?.querySelector('[data-project-favicon]');
          if (icon) favicon.href = icon.href;
          incoming.contentWindow.focus();
        });
      });
    }, { once: true });
    incoming.srcdoc = html; document.body.append(incoming);
  };
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'portfolio-preview-theme' && ['system', 'light', 'dark'].includes(event.data.choice)) {
      themeChoice = event.data.choice;
      document.documentElement.dataset.theme = event.data.resolved === 'dark' ? 'dark' : 'light';
      window.__PORTFOLIO_THEME_STATE__ = { choice: themeChoice, resolved: document.documentElement.dataset.theme };
    }
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
const startup = `(${initializeTheme.toString()})();`;
new Script(startup, { filename: 'preview-theme-startup.js' });
const output = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Derek Stone — Portfolio preview</title><style>html,body{margin:0;width:100%;height:100%}html{background:#fff;color-scheme:light}html[data-theme="dark"]{background:#17171b;color-scheme:dark}iframe{display:block;width:100%;height:100%;border:0}noscript{padding:24px;font:16px/1.5 Arial,sans-serif}</style><script>${startup}</script></head><body><iframe title="Derek Stone’s portfolio"></iframe><noscript>Open this preview in a browser with JavaScript enabled to explore Home, About, and Projects.</noscript><script type="application/json" id="preview-data">${payload}</script><script>${loader}</script></body></html>`;
await writeFile('portfolio-preview.html', output);
console.log(`Exported all three portfolio pages (${Math.round(Buffer.byteLength(output) / 1024)} KB).`);

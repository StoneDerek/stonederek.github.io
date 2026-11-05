import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import sharp from 'sharp';
// Keep a useful native Home document before scripts run. Other native pages,
// the inline Art gallery and the legacy Resume redirect remain self-contained.
const routes = {
  home: 'index.html', about: 'about/index.html', projects: 'projects/index.html',
  art: 'art/index.html', resume: 'resume/index.html'
};
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
    let type = mime[publicPath.split('.').pop().toLowerCase()];
    if (!type) throw new Error(`Unsupported preview image: ${publicPath}`);
    let bytes = await readFile(filename);
    if (publicPath.startsWith('art/') && type !== 'image/svg+xml') {
      // Preview copies are smaller; original project photographs stay untouched.
      bytes = await sharp(bytes).rotate().resize({ width: 1440, height: 1080, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 6 }).toBuffer();
      type = 'image/webp';
    }
    token = `__PORTFOLIO_ASSET_${imageTokens.size}__`;
    assets[token] = `data:${type};base64,${bytes.toString('base64')}`;
    imageTokens.set(publicPath, token);
  }
  embedded.set(path, token);
  return token;
}
for (const [route, file] of Object.entries(routes)) {
  let html = await readFile(resolve('dist', file), 'utf8');
  // The standalone address bridge handles navigation without fetching routes.
  html = html.replace(/<meta\b[^>]*name="astro-view-transitions-enabled"[^>]*>/g, '')
    .replace(/(<meta\b[^>]*name="astro-view-transitions-fallback"[^>]*content=")(?:animate|swap)("[^>]*>)/g, '$1none$2');
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:webp|svg|png|jpg))"/g)) {
    const path = match[1];
    const publicPath = path.match(/\/(art|thumbnails)\/.+$/)?.[0].slice(1) || path.match(/favicon\.svg$/)?.[0];
    if (!publicPath) throw new Error(`Cannot locate preview asset: ${path}`);
    await embedImage(path, publicPath);
  }
  for (const [path, token] of embedded) html = html.replaceAll(`="${path}"`, `="${token}"`);
  for (const data of [...html.matchAll(/<script\b[^>]*\bid="(?:portfolio-data|work-data|art-data)"[^>]*>([\s\S]*?)<\/script>/g)]) {
    const parsed = JSON.parse(data[1]);
    const projects = Array.isArray(parsed) ? parsed : [parsed];
    const base = html.match(/\bdata-asset-base="([^"]*)"/)?.[1] || html.match(/\bdata-base="([^"]*)"/)?.[1] || '/';
    for (const project of projects) {
      const media = [...(project.articleMedia || []), ...(project.caseStudy?.sections || []).flatMap(section => section.media || [])];
      for (const item of media) {
        if (!item.src || /^(https?:\/\/|\/\/|data:)/.test(item.src)) continue;
        const publicPath = item.src.startsWith(base) ? item.src.slice(base.length) : item.src.replace(/^\//, '');
        item.src = await embedImage(`${base}${publicPath}`, publicPath);
      }
    }
    html = html.replace(data[0], () => data[0].replace(data[1], () => JSON.stringify(parsed).replace(/</g, '\\u003c')));
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

function initializePreview(payload) {
  const { pages, assets, resumePDF, base, origin } = payload;
  const names = new Set(Object.keys(pages));
  let mountedRoute = 'home';
  let scheduled = false;
  let resumeAddress = null;

  const routeFor = address => {
    const url = new URL(address, origin);
    const path = url.pathname.replace(/\/index\.html$/, '/');
    if (!path.startsWith(base)) return null;
    const part = path.slice(base.length).replace(/^\/+|\/+$/g, '');
    const route = part === 'work' ? 'projects' : part || 'home';
    return names.has(route) ? route : null;
  };
  const addressFromHash = hash => {
    const [requested, ...rest] = hash.replace(/^#/, '').split('?');
    const name = requested === 'work' ? 'projects' : requested;
    const route = names.has(name) ? name : 'home';
    const fragment = rest.join('?');
    return `${base}${route === 'home' ? '' : `${route}/`}${fragment ? `#${fragment}` : ''}`;
  };
  const hashFromAddress = address => {
    const url = new URL(address, origin);
    return `#${routeFor(address) || 'home'}${url.hash ? `?${url.hash.slice(1)}` : ''}`;
  };
  const expand = page => {
    let html = page;
    for (const [token, value] of Object.entries(assets)) html = html.replaceAll(token, () => value);
    return html;
  };
  let currentAddress = addressFromHash(location.hash);
  window.__PORTFOLIO_PREVIEW_ADDRESS__ = currentAddress;

  function internalAddress(link) {
    if (link.dataset.previewAddress) return link.dataset.previewAddress;
    const href = link.getAttribute('href');
    if (!href || /^(?:mailto:|tel:|data:|blob:)/i.test(href)) return null;
    const url = new URL(href, new URL(currentAddress, origin));
    if (url.origin !== origin || !routeFor(url)) return null;
    return url.pathname + url.hash;
  }

  function connectLinks() {
    if (resumePDF && !resumeAddress) {
      try {
        resumeAddress = URL.createObjectURL(new Blob([
          Uint8Array.from(atob(resumePDF), char => char.charCodeAt(0))
        ], { type: 'application/pdf' }));
      } catch { /* Existing public PDF URLs remain useful if blobs are denied. */ }
    }
    for (const link of document.querySelectorAll('a[href]')) {
      const raw = link.getAttribute('href');
      const url = new URL(raw, new URL(currentAddress, origin));
      if (url.origin === origin && /\/resume\.pdf$/.test(url.pathname)) {
        link.href = resumeAddress || url.href;
        continue;
      }
      // Legacy gallery links are interpreted by its own controller. Footnotes
      // also keep their renderer-owned hashes and in-document focus behavior.
      if (link.matches('[data-site-route], [data-article-jump], .serif-skip-link')) continue;
      const address = internalAddress(link);
      if (!address) continue;
      link.dataset.previewAddress = address;
      link.href = `${location.href.split('#')[0]}${hashFromAddress(address)}`;
    }
  }

  function scrollToAddress(address) {
    const hash = new URL(address, origin).hash.slice(1);
    let id = '';
    try { id = decodeURIComponent(hash); } catch { /* Ignore malformed anchors. */ }
    const target = id && document.getElementById(id);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function mountAddress(address) {
    const route = routeFor(address) || 'home';
    currentAddress = address;
    window.__PORTFOLIO_PREVIEW_ADDRESS__ = address;
    if (route === 'resume' && resumePDF) {
      // The public compatibility route redirects straight to the PDF. Preserve
      // that behavior locally instead of mounting its meta-refresh document.
      connectLinks();
      location.replace(resumeAddress || new URL(`${base}resume.pdf`, origin).href);
      return;
    }
    window.dispatchEvent(new Event('portfolio:preview-unmount'));
    const next = new DOMParser().parseFromString(expand(pages[route]), 'text/html');
    for (const node of [document.documentElement, document.body]) {
      for (const attr of [...node.attributes]) node.removeAttribute(attr.name);
    }
    for (const attr of next.documentElement.attributes) document.documentElement.setAttribute(attr.name, attr.value);
    for (const attr of next.body.attributes) document.body.setAttribute(attr.name, attr.value);
    document.head.replaceChildren(...[...next.head.childNodes].map(node => document.importNode(node, true)));
    document.body.replaceChildren(...[...next.body.childNodes].map(node => document.importNode(node, true)));
    mountedRoute = route;
    // Scripts inserted by DOMParser/importNode are inert. Replace each with a
    // new inline script, in source order, after the whole next page is present.
    for (const old of [...document.scripts]) {
      if (old.type === 'application/json') continue;
      const script = document.createElement('script');
      for (const attr of old.attributes) script.setAttribute(attr.name, attr.value);
      script.textContent = old.textContent;
      old.replaceWith(script);
    }
    connectLinks();
    if (route !== 'projects' && route !== 'art') document.querySelector('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    scrollToAddress(address);
    window.dispatchEvent(new CustomEvent('portfolio:preview-mounted', { detail: { address } }));
  }

  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      mountAddress(currentAddress);
    });
  }

  window.__PORTFOLIO_PREVIEW_SET_ADDRESS__ = ({ address, replace = false, state = history.state }) => {
    currentAddress = address;
    window.__PORTFOLIO_PREVIEW_ADDRESS__ = address;
    const hash = hashFromAddress(address);
    try {
      history[replace ? 'replaceState' : 'pushState'](state, '', hash);
    } catch { /* Embedded viewers may deny history; local browsing still works. */ }
    if (routeFor(address) !== mountedRoute) scheduleMount();
  };
  const followHistory = () => {
    const address = addressFromHash(location.hash);
    if (address === currentAddress) return;
    currentAddress = address;
    window.__PORTFOLIO_PREVIEW_ADDRESS__ = address;
    if (routeFor(address) !== mountedRoute) mountAddress(address);
    else {
      window.dispatchEvent(new CustomEvent('portfolio:preview-navigate', { detail: { address } }));
      scrollToAddress(address);
    }
  };
  window.addEventListener('popstate', followHistory);
  window.addEventListener('hashchange', followHistory);
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || link.target === '_blank') return;
    if (document.querySelector('[data-work-root]') && link.matches('.serif-skip-link, [data-work-project], [data-work-close], [data-work-index]')) return;
    if (link.matches('.serif-skip-link')) {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target) {
        event.preventDefault();
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
      return;
    }
    const address = internalAddress(link);
    if (!address) return;
    event.preventDefault();
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address, state: null });
    if (routeFor(address) === mountedRoute) {
      window.dispatchEvent(new CustomEvent('portfolio:preview-navigate', { detail: { address } }));
      scrollToAddress(address);
    }
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted && resumeAddress) URL.revokeObjectURL(resumeAddress);
  });
  const initialize = () => {
    connectLinks();
    // Let the original Home app finish DOMContentLoaded before unmounting it.
    // This prevents its queued startup from mounting a second page controller.
    if (routeFor(currentAddress) !== mountedRoute) scheduleMount();
    else scrollToAddress(currentAddress);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
}

function expandPage(page) {
  let html = page;
  for (const [token, value] of Object.entries(assets)) html = html.replaceAll(token, () => value);
  return html;
}
for (const [route, page] of Object.entries(pages)) {
  const expanded = expandPage(page);
  if (/<iframe\b/i.test(expanded) || /__PORTFOLIO_(?:ASSET|RESOURCE)_\d+__/.test(expanded)) {
    throw new Error(`The ${route} preview contains an iframe or unresolved local asset.`);
  }
}
const home = expandPage(pages.home);
const base = home.match(/\bdata-base="([^"]*)"/)?.[1] || '/';
const origin = new URL(home.match(/<link\b[^>]*\brel="canonical"[^>]*\bhref="([^"]+)"/)?.[1] || 'https://stonederek.github.io/').origin;
const settings = JSON.stringify({ pages, assets, resumePDF, base, origin }).replaceAll('<', '\\u003c');
const loader = `(${initializePreview.toString()})(JSON.parse(document.getElementById('preview-payload').textContent));`;
new Script(loader, { filename: 'preview-navigation.js' });
let output = home.replace('<head>', () => `<head><script type="application/json" id="preview-payload">${settings}</script><script data-preview-bridge>${loader}</script>`);
output = output.replace(/<title>[^<]*<\/title>/, '<title>Derek Stone - Portfolio preview</title>');
for (const match of output.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (match[1].includes('application/json')) JSON.parse(match[2]);
  else new Script(match[2], { filename: 'complete-preview.js' });
}
await writeFile('portfolio-preview.html', output);
console.log(`Exported the native-page portfolio preview (${Math.round(Buffer.byteLength(output) / 1024)} KB).`);

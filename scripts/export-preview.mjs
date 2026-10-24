import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import { build } from 'esbuild';
import sharp from 'sharp';
import { previewAddress, previewHash } from '../src/scripts/gallery-location.js';

// The unified production document already contains Home, About and all projects.
// Export it directly so attachment viewers never begin with an empty iframe.
const routes = { home: 'index.html', resume: 'resume/index.html' };
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

function initializePreview({ resumePDF, resumeHTML }, addressFromHash, hashFromAddress) {
  let currentAddress = addressFromHash(location.hash);
  window.__PORTFOLIO_PREVIEW_ADDRESS__ = currentAddress;
  window.__PORTFOLIO_PREVIEW_SET_ADDRESS__ = ({ address, replace }) => {
    currentAddress = address;
    const hash = hashFromAddress(address);
    if (location.hash === hash) return;
    try {
      history[replace ? 'replaceState' : 'pushState'](null, '', hash);
    } catch { /* Embedded viewers can deny history; browsing still works. */ }
  };
  const followHistory = () => {
    const address = addressFromHash(location.hash);
    if (address === currentAddress) return;
    currentAddress = address;
    window.dispatchEvent(new CustomEvent('portfolio:preview-navigate', { detail: { address } }));
  };
  window.addEventListener('popstate', followHistory);
  window.addEventListener('hashchange', followHistory);

  const connectResume = () => {
    let resumeAddress;
    try {
      if (resumePDF) {
        resumeAddress = URL.createObjectURL(new Blob([
          Uint8Array.from(atob(resumePDF), char => char.charCodeAt(0))
        ], { type: 'application/pdf' }));
      } else {
        const home = `${location.href.split('#')[0]}#home`.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
        const html = resumeHTML.replace(/(<a\b[^>]*\bdata-resume-home\b[^>]*\bhref=")[^"]*(")/, `$1${home}$2`);
        resumeAddress = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      }
    } catch { return; }
    for (const link of document.querySelectorAll('[data-resume-link]')) link.href = resumeAddress;
    window.addEventListener('pagehide', event => {
      if (!event.persisted) URL.revokeObjectURL(resumeAddress);
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connectResume, { once: true });
  else connectResume();
}

function expandPage(page) {
  let html = page;
  for (const [token, value] of Object.entries(assets)) html = html.replaceAll(token, () => value);
  return html;
}
const settings = JSON.stringify({ resumePDF, resumeHTML: resumePDF ? null : expandPage(pages.resume) }).replaceAll('<', '\\u003c');
const loader = `(${initializePreview.toString()})(${settings},${previewAddress.toString()},${previewHash.toString()});`;
new Script(loader, { filename: 'preview-navigation.js' });
let output = expandPage(pages.home).replace('<head>', `<head><script>${loader}</script>`);
output = output.replace(/<title>[^<]*<\/title>/, '<title>Derek Stone - Portfolio preview</title>');
// Parse the complete output after expanding assets, including inline data.
for (const match of output.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (match[1].includes('application/json')) JSON.parse(match[2]);
  else new Script(match[2], { filename: 'complete-preview.js' });
}
if (/<iframe\b/i.test(output) || /__PORTFOLIO_(?:ASSET|RESOURCE)_\d+__/.test(output)) {
  throw new Error('The standalone preview contains an iframe or an unresolved local asset.');
}
await writeFile('portfolio-preview.html', output);
console.log(`Exported the direct-page portfolio preview (${Math.round(Buffer.byteLength(output) / 1024)} KB).`);

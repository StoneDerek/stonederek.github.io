import { firstProjectPanel } from '../data/gallery-panels.js';

export function sectionForPanel(index) {
  return index === 0 ? 'home' : index === 1 ? 'about' : 'projects';
}

export function resolveGalleryLocation(address, panels) {
  const url = new URL(address, 'https://portfolio.invalid');
  const path = url.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
  const artRoute = path.endsWith('/art');
  const section = path.endsWith('/about') ? 'about' : path.endsWith('/projects') || artRoute ? 'projects' : 'home';
  if (section !== 'projects') {
    let anchor = '';
    try { anchor = decodeURIComponent(url.hash.slice(1)); } catch { /* Ignore malformed anchors. */ }
    return { panel: section === 'home' ? 0 : 1, article: null, anchor };
  }
  const query = new URLSearchParams(url.hash.slice(1));
  const project = slug => panels.findIndex(panel => panel.kind === 'project' &&
    (panel.slug === slug || panel.legacySlugs?.includes(slug)));
  const article = project(query.get('project'));
  if (article >= firstProjectPanel) return { panel: article, article, anchor: '' };
  if (query.has('links')) return { panel: panels.length, article: null, anchor: '' };
  const slide = project(query.get('slide'));
  const art = project('art');
  const fallback = artRoute && art >= firstProjectPanel ? art : firstProjectPanel;
  return { panel: slide >= firstProjectPanel ? slide : fallback, article: null, anchor: '' };
}

export function galleryAddress(index, panels, { base = '/', article = false, anchor = '', galleryPath = 'projects/' } = {}) {
  const root = `${base.replace(/\/$/, '')}/`;
  const path = galleryPath === 'art/' ? 'art/' : 'projects/';
  const art = panels.findIndex(panel => panel.slug === 'art');
  const initial = path === 'art/' && art >= firstProjectPanel ? art : firstProjectPanel;
  const panel = Math.max(0, Math.min(panels.length, Math.round(index)));
  if (article) {
    if (panels[panel]?.kind !== 'project') throw new TypeError('Only project panels have articles');
    return `${root}${path}#project=${encodeURIComponent(panels[panel].slug)}`;
  }
  if (panel < firstProjectPanel) return `${root}${panel === 1 ? 'about/' : ''}${anchor ? `#${encodeURIComponent(anchor)}` : ''}`;
  if (panel === panels.length) return `${root}${path}#links`;
  return `${root}${path}${panel === initial ? '' : `#slide=${encodeURIComponent(panels[panel].slug)}`}`;
}

// The downloaded preview uses the same persistent gallery app and hash routes.
export function previewAddress(hash) {
  const [requested, fragment = ''] = hash.replace(/^#/, '').split('?');
  const route = ['home', 'about', 'projects'].includes(requested) ? requested : 'home';
  return `/${route === 'home' ? '' : `${route}/`}${fragment ? `#${fragment}` : ''}`;
}

export function previewHash(address) {
  const url = new URL(address, 'https://portfolio.invalid');
  const path = url.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
  const route = path.endsWith('/about') ? 'about' : path.endsWith('/projects') ? 'projects' : 'home';
  return `#${route}${url.hash ? `?${url.hash.slice(1)}` : ''}`;
}

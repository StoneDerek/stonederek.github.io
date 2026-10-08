import { projectIndexFromHash } from './project-links.js';
import { projectMediaSource } from './project-case-study.js';

// Decode the visible gallery assets before the router captures its new page.
// A slower connection keeps the current section usable instead of capturing
// empty image boxes and replacing them after the transition finishes.
export function prepareGalleryImages(doc, base, signal) {
  const data = doc?.getElementById('portfolio-data');
  const projects = data ? JSON.parse(data.textContent) : [];
  const index = projectIndexFromHash(base.hash, projects);
  const images = doc?.querySelectorAll(`#portfolio [data-slide="${Math.max(0, index)}"] img, #portfolio [data-thumbnail] img`) || [];
  const assets = [...images].map(node => ({ src: node.getAttribute('src'),
    priority: node.closest('[data-slide]') ? 'high' : 'low',
    critical: Boolean(node.closest('[data-slide]'))
      || Number(node.closest('[data-thumbnail]')?.dataset.thumbnail) === Math.max(0, index) }));
  const firstMedia = projects[index]?.articleMedia?.find(item => item.src);
  if (firstMedia) {
    const assetBase = doc.querySelector('[data-detail-media]').dataset.assetBase;
    assets.push({ src: projectMediaSource(firstMedia.src, assetBase), priority: 'high', critical: true });
  }
  // Warm the whole strip, but wait only for the cover, centered thumbnail, and
  // first article image. A stalled neighboring thumbnail must not hold the route.
  const pending = assets.map(asset => new Promise(resolve => {
    if (signal?.aborted) { resolve(); return; }
    const image = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => { finish(); image.src = ''; };
    image.onload = () => {
      if (typeof image.decode === 'function') image.decode().catch(() => {}).finally(finish);
      else finish();
    };
    image.onerror = finish;
    signal?.addEventListener('abort', abort, { once: true });
    image.fetchPriority = asset.priority;
    image.src = new URL(asset.src, base).href;
  }));
  return Promise.all(pending.filter((_, index) => assets[index].critical));
}

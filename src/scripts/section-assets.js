// Decode the visible gallery assets before the router captures its new page.
// A slower connection keeps the current section usable instead of capturing
// empty image boxes and replacing them after the transition finishes.
export function prepareGalleryImages(doc, base, signal) {
  const images = doc?.querySelectorAll('#portfolio [data-slide="0"] img, #portfolio [data-thumbnail] img') || [];
  return Promise.all([...images].map(node => new Promise(resolve => {
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
    image.fetchPriority = node.closest('[data-slide]') ? 'high' : 'low';
    image.src = new URL(node.getAttribute('src'), base).href;
  })));
}

const darkInk = '#000000';
const lightInk = '#ffffff';
const channel = value => {
  const scaled = value / 255;
  return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4;
};
const luminance = ([red, green, blue]) => .2126 * channel(red) + .7152 * channel(green) + .0722 * channel(blue);
const contrast = (first, second) => (Math.max(first, second) + .05) / (Math.min(first, second) + .05);

export function intersectRectangles(first, second) {
  const left = Math.max(first.left, second.left), top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right), bottom = Math.min(first.bottom, second.bottom);
  return right > left && bottom > top ? { left, top, right, bottom, width: right - left, height: bottom - top } : null;
}

export function imagePaintBounds(rect, width, height, fit = 'fill', position = '50% 50%') {
  if (!(width > 0 && height > 0 && rect.width > 0 && rect.height > 0)) return null;
  let drawnWidth = rect.width, drawnHeight = rect.height;
  if (fit === 'contain' || fit === 'cover' || fit === 'none' || fit === 'scale-down') {
    const contain = Math.min(rect.width / width, rect.height / height);
    const scale = fit === 'cover' ? Math.max(rect.width / width, rect.height / height) : fit === 'none' ? 1 : fit === 'scale-down' ? Math.min(1, contain) : contain;
    drawnWidth = width * scale; drawnHeight = height * scale;
  }
  const positions = position.trim().split(/\s+/);
  const offset = (token, remaining) => {
    if (token === 'left' || token === 'top') return 0;
    if (token === 'right' || token === 'bottom') return remaining;
    if (!token || token === 'center') return remaining / 2;
    return token.endsWith('%') ? remaining * (parseFloat(token) || 0) / 100 : parseFloat(token) || 0;
  };
  const left = rect.left + offset(positions[0], rect.width - drawnWidth);
  const top = rect.top + offset(positions[1], rect.height - drawnHeight);
  return { left, top, right: left + drawnWidth, bottom: top + drawnHeight, width: drawnWidth, height: drawnHeight };
}

// One source-wide choice is shared by every navigation line over the image.
export function sourceImageInk(pixels) {
  let total = 0, count = 0;
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    total += luminance([0, 1, 2].map(channel => pixels[index + channel] * alpha + 255 * (1 - alpha)));
    count++;
  }
  const average = total / Math.max(1, count);
  return contrast(0, average) >= contrast(1, average) ? darkInk : lightInk;
}

export function mountNavigationContrast(nav) {
  if (!nav) return () => {};
  const doc = nav.ownerDocument, view = doc.defaultView;
  const main = doc.querySelector('main');
  if (!view || !main || !view.MutationObserver) return () => {};
  const links = [...nav.querySelectorAll('a[href]')];
  const controller = new view.AbortController();
  const desktop = view.matchMedia('(min-width: 880px)');
  const inks = new WeakMap();
  const rendered = new WeakMap();
  let frame = 0, disposed = false;
  const listen = (target, type, handler, options) => target?.addEventListener(type, handler,
    { ...options, signal: controller.signal });
  const clear = link => {
    if (!rendered.has(link)) return;
    link.removeAttribute('data-nav-image-overlap');
    for (const property of ['--nav-image-layers', '--nav-image-positions', '--nav-image-sizes']) link.style.removeProperty(property);
    rendered.delete(link);
  };

  function inkFor(image) {
    const source = image.currentSrc || image.src;
    const old = inks.get(image);
    if (old?.source === source) return old.ink;
    if (!(image.complete && image.naturalWidth > 0)) return null;
    try {
      const canvas = doc.createElement('canvas');
      canvas.width = canvas.height = 96;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) { inks.set(image, { source, ink: null }); return null; }
      context.drawImage(image, 0, 0, 96, 96);
      const ink = sourceImageInk(context.getImageData(0, 0, 96, 96).data);
      inks.set(image, { source, ink });
      return ink;
    } catch {
      // Cross-origin imagery without CORS cannot be sampled; keep normal ink.
      inks.set(image, { source, ink: null });
      return null;
    }
  }

  function readImages() {
    const styles = new Map();
    const styleFor = element => {
      if (!styles.has(element)) styles.set(element, view.getComputedStyle(element));
      return styles.get(element);
    };
    const result = [];
    for (const image of main.querySelectorAll('img')) {
      if (image.closest('dialog')) continue;
      const rect = image.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) continue;
      const style = styleFor(image);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const painted = imagePaintBounds(rect, image.naturalWidth || image.width, image.naturalHeight || image.height,
        style.objectFit, style.objectPosition);
      let visible = painted && intersectRectangles(painted, rect);
      for (let parent = image.parentElement; visible && parent && parent !== doc.body; parent = parent.parentElement) {
        const parentStyle = styleFor(parent);
        if (parentStyle.visibility === 'hidden' || parentStyle.display === 'none') { visible = null; break; }
        const clipX = /^(hidden|clip|auto|scroll)$/.test(parentStyle.overflowX);
        const clipY = /^(hidden|clip|auto|scroll)$/.test(parentStyle.overflowY);
        if (!clipX && !clipY) continue;
        const clip = parent.getBoundingClientRect();
        visible = intersectRectangles(visible, {
          left: clipX ? clip.left : visible.left, right: clipX ? clip.right : visible.right,
          top: clipY ? clip.top : visible.top, bottom: clipY ? clip.bottom : visible.bottom
        });
      }
      if (visible) result.push({ image, visible });
    }
    return result;
  }

  function update() {
    frame = 0;
    if (disposed || doc.hidden) return;
    if (!desktop.matches || nav.getBoundingClientRect().width === 0) { links.forEach(clear); return; }
    const images = readImages();
    const updates = links.map(link => {
      const rect = link.getBoundingClientRect();
      const zones = [];
      for (const image of images) {
        const overlap = intersectRectangles(rect, image.visible);
        if (!overlap) continue;
        const ink = inkFor(image.image);
        if (!ink) continue;
        zones.unshift({ ink, x: overlap.left - rect.left, y: overlap.top - rect.top, width: overlap.width, height: overlap.height });
      }
      return { link, zones };
    });
    for (const { link, zones } of updates) {
      if (!zones.length) { clear(link); continue; }
      const value = {
        layers: [...zones.map(zone => `linear-gradient(${zone.ink}, ${zone.ink})`), 'linear-gradient(var(--page-text), var(--page-text))'].join(', '),
        positions: [...zones.map(zone => `${zone.x}px ${zone.y}px`), '0 0'].join(', '),
        sizes: [...zones.map(zone => `${zone.width}px ${zone.height}px`), '100% 100%'].join(', ')
      };
      const signature = JSON.stringify(value);
      if (rendered.get(link) === signature) continue;
      link.dataset.navImageOverlap = '';
      link.style.setProperty('--nav-image-layers', value.layers);
      link.style.setProperty('--nav-image-positions', value.positions);
      link.style.setProperty('--nav-image-sizes', value.sizes);
      rendered.set(link, signature);
    }
    if (main.querySelector('[data-art-root]:is(.is-moving, .is-dragging, .is-lifting)')) schedule();
  }

  function schedule() { if (!disposed && !frame && !doc.hidden) frame = view.requestAnimationFrame(update); }
  const observer = new view.MutationObserver(schedule);
  observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'src', 'srcset'] });
  listen(doc, 'scroll', schedule, { capture: true, passive: true });
  listen(view, 'resize', schedule, { passive: true });
  listen(desktop, 'change', schedule);
  listen(doc, 'portfolio:theme-change', schedule);
  listen(doc, 'load', event => { if (event.target?.tagName === 'IMG') { inks.delete(event.target); schedule(); } }, { capture: true });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) { view.cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  doc.fonts?.ready?.then(schedule);
  listen(doc.fonts, 'loadingdone', schedule);
  schedule();
  return () => {
    disposed = true;
    view.cancelAnimationFrame(frame);
    observer.disconnect(); controller.abort(); links.forEach(clear);
  };
}

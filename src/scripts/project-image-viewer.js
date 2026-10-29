import { fitImage, zoomImage, panImage, resizeImage } from './image-zoom.js';

// One native modal serves all article photos, including images rendered later.
export function mountProjectImageViewer(root, article, { reducedMotion } = {}) {
  const dialog = root.querySelector('[data-image-viewer]');
  const fullImage = dialog.querySelector('[data-image-full]');
  const caption = dialog.querySelector('[data-image-caption]');
  const toolbar = dialog.querySelector('.image-viewer-toolbar');
  const closeButton = dialog.querySelector('[data-image-close]');
  const zoomButton = dialog.querySelector('[data-image-zoom]');
  const zoomOut = dialog.querySelector('[data-image-zoom-out]');
  const fitButton = dialog.querySelector('[data-image-fit]');
  const scaleLabel = dialog.querySelector('[data-image-scale]');
  const label = dialog.querySelector('[data-image-label]');
  const canvas = dialog.querySelector('[data-image-canvas]');
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  reducedMotion ||= view.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (node, type, handler, options) => node.addEventListener(type, handler, { ...options, signal: controller.signal });
  let opener = null;
  let savedOverflow = '', savedScrollTop = 0;
  let sourceWidth = 0, sourceHeight = 0;
  let motion = null, closing = false, closeRestoreFocus = true;
  let image = null, zoomFrame = 0, zoomTarget = null;
  const pointers = new Map();
  let gestureMoved = false, suppressClick = false, lastTap = null;

  function cancelMotion() {
    const current = motion;
    motion = null;
    current?.cancel();
  }

  function animate(from, to, duration, done) {
    cancelMotion();
    if (reducedMotion.matches || doc.hidden || !dialog.animate) { done?.(); return; }
    const current = dialog.animate([from, to], {
      duration, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both'
    });
    motion = current;
    current.finished.then(() => {
      if (motion !== current) return;
      motion = null;
      done?.();
      current.cancel();
    }).catch(() => {});
  }

  function stopZoom() {
    cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    zoomTarget = null;
  }

  function renderImage() {
    if (!image) return;
    fullImage.style.width = `${image.width}px`;
    fullImage.style.height = `${image.height}px`;
    fullImage.style.transform = `translate3d(${image.x}px, ${image.y}px, 0) scale(${image.zoom})`;
    const target = zoomTarget || image;
    canvas.toggleAttribute('data-can-zoom', image.maxZoom > 1.001);
    canvas.toggleAttribute('data-zoomed', image.zoom > 1.001);
    // Keep the focused control available for keyboard zoom in the other direction.
    zoomButton.setAttribute('aria-disabled', String(target.zoom >= image.maxZoom - .001));
    zoomOut.setAttribute('aria-disabled', String(target.zoom <= 1.001));
    fitButton.setAttribute('aria-disabled', String(target.zoom <= 1.001));
    // Percentages refer to source pixels: 100% is actual size.
    scaleLabel.textContent = `${Math.round(target.zoom * image.fit * 100)}%`;
    scaleLabel.setAttribute('aria-label', `Zoom level: ${scaleLabel.textContent}${target.zoom <= 1.001 ? ', fitted' : ''}`);
  }

  function setZoom(level, point, smooth = false) {
    if (!image || closing || !dialog.open) return;
    cancelMotion(); stopZoom();
    const next = zoomImage(image, level, point);
    if (!smooth || reducedMotion.matches || doc.hidden) {
      image = next; renderImage(); return;
    }
    const from = image, start = performance.now();
    zoomTarget = next;
    renderImage();
    const tick = now => {
      const t = Math.min(1, (now - start) / 160);
      const eased = 1 - (1 - t) ** 3;
      image = { ...next,
        zoom: from.zoom + (next.zoom - from.zoom) * eased,
        x: from.x + (next.x - from.x) * eased,
        y: from.y + (next.y - from.y) * eased
      };
      if (t < 1) zoomFrame = requestAnimationFrame(tick);
      else { zoomFrame = 0; zoomTarget = null; }
      renderImage();
    };
    zoomFrame = requestAnimationFrame(tick);
  }

  function zoomBy(factor, point, smooth = true) {
    if (!image) return;
    const current = (zoomTarget || image).zoom;
    const next = Math.max(1, Math.min(image.maxZoom, current * factor));
    if (Math.abs(next - current) > .000001) setZoom(next, point, smooth);
  }

  function clearPointers() {
    const ids = [...pointers.keys()];
    pointers.clear();
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    delete canvas.dataset.panning;
    gestureMoved = false; suppressClick = false; lastTap = null;
  }

  function layout() {
    if (!opener || !dialog.open || closing) return;
    stopZoom(); clearPointers();
    const width = fullImage.naturalWidth || sourceWidth;
    const height = fullImage.naturalHeight || sourceHeight;
    if (!width || !height) return;
    const viewportWidth = view.visualViewport?.width || view.innerWidth;
    const viewportHeight = view.visualViewport?.height || view.innerHeight;
    const mobile = viewportWidth <= 600;
    const style = view.getComputedStyle(dialog);
    const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableWidth = Math.max(1, Math.min(1600, viewportWidth - (mobile ? paddingX : 48)));
    const toolbarHeight = toolbar.offsetHeight || toolbar.getBoundingClientRect().height;
    const availableHeight = Math.max(1, viewportHeight - (mobile ? paddingY : 48) - toolbarHeight - 8);
    const fit = Math.min(1, availableWidth / width, availableHeight / height);
    const canvasWidth = mobile ? availableWidth : Math.max(width * fit, Math.min(300, availableWidth));
    canvas.style.width = `${canvasWidth}px`;
    // Establish caption wrapping before measuring its actual height.
    dialog.style.width = `${canvasWidth + paddingX}px`;
    const captionHeight = caption.hidden ? 0 : (caption.offsetHeight || caption.getBoundingClientRect().height) + 8;
    const areaHeight = Math.max(1, availableHeight - captionHeight);
    const finalFit = Math.min(1, canvasWidth / width, areaHeight / height);
    const canvasHeight = mobile ? areaHeight : height * finalFit;
    canvas.style.height = `${canvasHeight}px`;
    const next = fitImage(width, height, canvasWidth, canvasHeight);
    image = image && image.zoom > 1.001 ? resizeImage(image, next) : next;
    renderImage();
  }

  function pointFrom(event) {
    // Read the settled canvas if input interrupts the opening scale effect.
    cancelMotion();
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function release(restoreFocus) {
    if (!opener) return;
    const target = opener;
    opener = null;
    stopZoom(); clearPointers(); image = null;
    delete canvas.dataset.canZoom;
    delete canvas.dataset.zoomed;
    canvas.style.width = canvas.style.height = dialog.style.width = '';
    fullImage.style.width = fullImage.style.height = fullImage.style.transform = '';
    article.style.overflow = savedOverflow;
    article.scrollTop = savedScrollTop;
    fullImage.removeAttribute('src');
    fullImage.alt = '';
    fullImage.removeAttribute('width');
    fullImage.removeAttribute('height');
    label.textContent = 'Image';
    caption.textContent = '';
    caption.hidden = true;
    if (restoreFocus && target.isConnected && !article.hidden && !article.inert) target.focus({ preventScroll: true });
  }

  function finishClose(restoreFocus) {
    cancelMotion(); closing = false;
    delete dialog.dataset.closing;
    if (dialog.open) dialog.close();
    release(restoreFocus);
  }

  function close({ restoreFocus = true, immediate = false } = {}) {
    if (immediate || !dialog.open || reducedMotion.matches || doc.hidden || !dialog.animate) {
      finishClose(restoreFocus); return;
    }
    if (closing) return;
    stopZoom(); clearPointers();
    closeRestoreFocus = restoreFocus;
    const drawn = view.getComputedStyle(dialog);
    const from = { opacity: drawn.opacity || '1', transform: drawn.transform || 'none' };
    closing = true;
    dialog.dataset.closing = '';
    animate(from, { opacity: 0, transform: 'scale(.985)' }, 120, () => finishClose(restoreFocus));
  }

  listen(root, 'click', event => {
    const button = event.target.closest('[data-image-open]');
    if (!button || !article.contains(button) || article.hidden || article.inert || dialog.open) return;
    const original = button.querySelector('img');
    if (!original?.getAttribute('src')) return;
    event.preventDefault();
    opener = button;
    savedOverflow = article.style.overflow;
    savedScrollTop = article.scrollTop;
    sourceWidth = original.naturalWidth || Number(original.getAttribute('width'));
    sourceHeight = original.naturalHeight || Number(original.getAttribute('height'));
    if (sourceWidth) fullImage.width = sourceWidth;
    if (sourceHeight) fullImage.height = sourceHeight;
    fullImage.src = original.currentSrc || original.src;
    fullImage.alt = original.alt;
    const section = button.closest('.case-study-section')?.querySelector('h2')?.textContent;
    label.textContent = [article.querySelector('[data-detail-title]')?.textContent, section].filter(Boolean).join(' / ') || 'Image';
    caption.textContent = button.closest('figure')?.querySelector('figcaption')?.textContent || '';
    caption.hidden = !caption.textContent;
    article.style.overflow = 'hidden';
    dialog.showModal(); layout();
    closeButton.focus({ preventScroll: true });
    animate({ opacity: 0, transform: 'scale(.985)' }, { opacity: 1, transform: 'none' }, 180);
  });
  listen(fullImage, 'load', layout);
  listen(zoomButton, 'click', () => zoomBy(1.5));
  listen(zoomOut, 'click', () => zoomBy(1 / 1.5));
  listen(fitButton, 'click', () => {
    if (!image || (zoomTarget || image).zoom <= 1.001) return;
    clearPointers(); setZoom(1, undefined, true);
  });
  listen(canvas, 'click', event => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (event.target === fullImage || canvas.hasAttribute('data-zoomed')) {
      event.preventDefault(); event.stopPropagation();
      if (image && image.zoom <= 1.001) setZoom(Math.min(2, image.maxZoom), pointFrom(event), true);
    }
  });
  listen(canvas, 'wheel', event => {
    if (!image || closing) return;
    event.preventDefault(); event.stopPropagation();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? image.viewportHeight : 1);
    zoomBy(Math.exp(-Math.max(-240, Math.min(240, pixels)) * .003), pointFrom(event), false);
  }, { passive: false });

  listen(canvas, 'pointerdown', event => {
    if (!image || closing || event.pointerType === 'mouse' && (event.button !== 0 || image.zoom <= 1.001)) return;
    cancelMotion(); stopZoom();
    if (!pointers.size) { gestureMoved = false; suppressClick = false; }
    const point = pointFrom(event);
    pointers.set(event.pointerId, { ...point, startX: point.x, startY: point.y, type: event.pointerType });
    if (pointers.size > 1) { gestureMoved = true; suppressClick = true; lastTap = null; }
    canvas.setPointerCapture(event.pointerId);
    if (image.zoom > 1.001) canvas.dataset.panning = '';
    event.preventDefault();
  });
  listen(canvas, 'pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous || !image || closing) return;
    const before = [...pointers.values()].slice(0, 2);
    const point = pointFrom(event);
    pointers.set(event.pointerId, { ...previous, ...point });
    const after = [...pointers.values()].slice(0, 2);
    gestureMoved ||= Math.hypot(point.x - previous.startX, point.y - previous.startY) > 4;
    if (after.length === 2) {
      const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const from = midpoint(before), to = midpoint(after);
      // Apply translation and scale together before clamping at image edges.
      image = zoomImage({ ...image, x: image.x + to.x - from.x, y: image.y + to.y - from.y },
        image.zoom * distance(after) / Math.max(1, distance(before)), to);
    } else image = panImage(image, point.x - previous.x, point.y - previous.y);
    if (gestureMoved) { suppressClick = true; lastTap = null; }
    if (image.zoom > 1.001) canvas.dataset.panning = '';
    renderImage(); event.preventDefault();
  });
  const endPointer = event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!pointers.size) delete canvas.dataset.panning;
    suppressClick ||= gestureMoved || previous.type !== 'mouse';
    if (event.type === 'pointerup' && previous.type !== 'mouse' && !gestureMoved && !pointers.size) {
      const now = performance.now();
      if (lastTap && now - lastTap.time < 300 && Math.hypot(previous.x - lastTap.x, previous.y - lastTap.y) < 24) {
        setZoom(image.zoom > 1.001 ? 1 : Math.min(2, image.maxZoom), previous, true);
        lastTap = null;
      } else lastTap = { ...previous, time: now };
    }
    if (event.type !== 'pointerup') lastTap = null;
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, type, endPointer);

  listen(dialog, 'keydown', event => {
    if (!image || closing || event.ctrlKey || event.metaKey || event.altKey) return;
    const amount = event.shiftKey ? 160 : 48;
    const directions = { ArrowLeft: [amount, 0], ArrowRight: [-amount, 0], ArrowUp: [0, amount], ArrowDown: [0, -amount] };
    if (['+', '='].includes(event.key)) zoomBy(1.5);
    else if (['-', '−', '_'].includes(event.key)) zoomBy(1 / 1.5);
    else if (['0', 'f', 'F'].includes(event.key)) setZoom(1, undefined, true);
    else if (directions[event.key] && image.zoom > 1.001) {
      cancelMotion(); stopZoom();
      image = panImage(image, ...directions[event.key]); renderImage();
    } else return;
    event.preventDefault(); event.stopPropagation();
  });
  listen(closeButton, 'click', () => close());
  listen(dialog, 'click', event => {
    if (!event.defaultPrevented && (event.target === dialog || event.target.matches('[data-image-canvas], .image-viewer-figure'))) close();
  });
  listen(dialog, 'cancel', event => { event.preventDefault(); close(); });
  listen(dialog, 'close', () => { if (!dialog.open) { cancelMotion(); release(true); } });
  const settleMotion = () => {
    if (closing) finishClose(closeRestoreFocus);
    else cancelMotion();
    if (zoomTarget) { const target = zoomTarget; stopZoom(); image = target; renderImage(); }
    clearPointers();
  };
  listen(reducedMotion, 'change', event => { if (event.matches) settleMotion(); });
  listen(doc, 'visibilitychange', () => { if (doc.hidden) settleMotion(); });
  listen(view, 'resize', layout);
  if (view.visualViewport) listen(view.visualViewport, 'resize', layout);

  return { close, destroy() { close({ restoreFocus: false, immediate: true }); controller.abort(); } };
}

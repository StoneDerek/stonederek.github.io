import { createScrollReveal } from './section-state.js';

export function mountSectionLinks() {
  const header = document.querySelector('.site-header');
  const links = header?.querySelector('.page-links');
  if (!links) return { hide() {}, destroy() {} };
  const controller = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: controller.signal });
  const gallery = header.dataset.page === 'projects';
  const state = createScrollReveal({ hidden: gallery || window.scrollY > 8 });
  const positions = new WeakMap();
  let windowPosition = window.scrollY;
  let touch = null;
  let press = null;
  let pressTimer = 0;
  const clearPress = () => {
    clearTimeout(pressTimer);
    press?.link.removeAttribute('data-pressed');
    press = null;
  };
  // Touch browsers can omit :active while deciding whether a finger will scroll.
  listen(links, 'pointerdown', event => {
    if (!event.isPrimary || event.pointerType === 'mouse' || event.button !== 0) return;
    clearPress();
    const link = event.target.closest('a');
    if (!link) return;
    press = { link, id: event.pointerId };
    link.setAttribute('data-pressed', '');
  }, { passive: true });
  listen(document, 'pointerup', event => {
    if (press?.id === event.pointerId) pressTimer = setTimeout(clearPress, 80);
  }, { passive: true });
  listen(document, 'pointercancel', event => {
    if (press?.id === event.pointerId) clearPress();
  }, { passive: true });
  function apply(hidden) {
    const focused = links.contains(document.activeElement);
    if (hidden && (press || (focused && document.activeElement.matches(':focus-visible')))) return;
    if (hidden && focused) header.querySelector('summary').focus({ preventScroll: true });
    links.dataset.scrolled = String(hidden);
    links.inert = hidden;
    links.setAttribute('aria-hidden', String(hidden));
  }
  function move(delta) { apply(state.move(delta)); }
  function hide() { apply(state.setHidden(true)); }
  listen(document, 'scroll', event => {
    const page = event.target === document;
    const article = event.target instanceof Element && event.target.matches('[data-project-view]');
    if ((!page && !article) || (page && gallery)) return;
    const scroller = page ? document.scrollingElement : event.target;
    // Ignore browser overscroll outside a native page/article's real bounds.
    const now = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, page ? window.scrollY : scroller.scrollTop));
    const previous = page ? windowPosition : positions.get(event.target) || 0;
    if (page) windowPosition = now;
    else positions.set(event.target, now);
    if (!gallery && now <= 8) apply(state.setHidden(false));
    else move(now - previous);
  }, { capture: true, passive: true });
  // The full-screen gallery has no vertical document scroll. Read its vertical
  // wheel/touch intent while leaving normal gallery and thumbnail gestures alone.
  const onGallery = target => gallery && !target.closest('.site-header, .gallery-about, .thumbnail-rail, [data-project-view], [data-laser-control], [data-credits]');
  listen(document, 'wheel', event => {
    if (!onGallery(event.target) || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    move(event.deltaY * unit);
  }, { passive: true });
  listen(document, 'touchstart', event => {
    state.endTouch();
    touch = event.touches.length === 1 && !header.contains(event.target)
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY, lastY: event.touches[0].clientY,
        axis: null, gallery: onGallery(event.target) } : null;
    if (touch) state.beginTouch();
  }, { passive: true });
  listen(document, 'touchmove', event => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    if (!touch.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) touch.axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
    if (touch.gallery && touch.axis === 'y') move(touch.lastY - point.clientY);
    touch.lastY = point.clientY;
  }, { passive: true });
  const endTouch = () => { touch = null; state.endTouch(); };
  listen(document, 'touchend', endTouch, { passive: true });
  listen(document, 'touchcancel', endTouch, { passive: true });
  listen(links, 'focusout', () => { queueMicrotask(() => apply(state.hidden)); });
  apply(state.hidden);
  return { hide, destroy() { clearPress(); controller.abort(); } };
}

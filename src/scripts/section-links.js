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
  let aboutProgress = 0;
  let aboutCurrent = false;
  function apply(hidden) {
    if (hidden && !aboutProgress && links.contains(document.activeElement)) return;
    const inert = aboutProgress ? aboutProgress < 1 : hidden;
    links.dataset.scrolled = String(hidden);
    links.inert = inert;
    links.setAttribute('aria-hidden', String(inert));
  }
  function move(delta) { apply(state.move(delta)); }
  function hide() { apply(state.setHidden(true)); }
  function previewAbout(progress) {
    if (!gallery) return;
    const returning = aboutProgress > 0 && progress === 0;
    aboutProgress = progress;
    const current = progress >= .5;
    if (current !== aboutCurrent) {
      aboutCurrent = current;
      links.querySelectorAll('[data-site-route]').forEach(link => {
        if (link.dataset.siteRoute === (current ? 'about' : 'projects')) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }
    if (progress) links.dataset.aboutReady = String(progress >= 1);
    else delete links.dataset.aboutReady;
    if (returning && state.hidden && links.contains(document.activeElement)) header.querySelector('summary').focus({ preventScroll: true });
    apply(state.hidden);
  }
  listen(document, 'scroll', event => {
    const page = event.target === document;
    const article = event.target instanceof Element && event.target.matches('[data-project-view]');
    if (!page && !article) return;
    const now = page ? window.scrollY : event.target.scrollTop;
    const previous = page ? windowPosition : positions.get(event.target) || 0;
    if (page) windowPosition = now;
    else positions.set(event.target, now);
    if (!gallery && now <= 8) apply(state.setHidden(false));
    else move(now - previous);
  }, { capture: true, passive: true });
  // The full-screen gallery has no vertical document scroll. Read its vertical
  // wheel/touch intent while leaving normal gallery and thumbnail gestures alone.
  const onGallery = target => gallery && !target.closest('.site-header, .thumbnail-rail, [data-project-view]');
  listen(document, 'wheel', event => {
    if (!onGallery(event.target) || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    move(event.deltaY * unit);
  }, { passive: true });
  listen(document, 'touchstart', event => {
    touch = event.touches.length === 1 && onGallery(event.target)
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY, lastY: event.touches[0].clientY } : null;
  }, { passive: true });
  listen(document, 'touchmove', event => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0];
    const dx = point.clientX - touch.x;
    const dy = point.clientY - touch.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) move(touch.lastY - point.clientY);
    touch.lastY = point.clientY;
  }, { passive: true });
  listen(document, 'touchend', () => { touch = null; }, { passive: true });
  listen(document, 'touchcancel', () => { touch = null; }, { passive: true });
  listen(links, 'focusout', () => { queueMicrotask(() => apply(state.hidden)); });
  apply(state.hidden);
  return { hide, previewAbout, destroy() { controller.abort(); } };
}

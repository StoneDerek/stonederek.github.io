import { mountSiteMenu } from './site-menu.js';
import { mountProjectMenu } from './project-menu.js';

// The prose pages share the gallery's native, animated navigation.
export function mountProfileNavigation() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const menu = header.querySelector('[data-menu]');
  const toggle = menu.querySelector('summary');
  const projects = menu.querySelector('[data-projects-menu]');
  const projectsToggle = projects.querySelector('[data-projects-toggle]');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: controller.signal });
  const nested = mountProjectMenu(projects, preference, { signal: controller.signal });
  const navigation = mountSiteMenu(menu, preference, { signal: controller.signal, onChange: () => {
    toggle.setAttribute('aria-label', `${navigation.expanded ? 'Close' : 'Open'} navigation. ${header.dataset.page === 'about' ? 'About' : 'Home'}: ${header.dataset.owner}`);
  } });
  const choices = [...menu.querySelectorAll('a[href], [data-projects-toggle]')];
  const visible = () => choices.filter(choice => choice === projectsToggle || !projects.contains(choice) || nested.expanded);
  const close = (focus = false) => navigation.set(false, { focus });
  listen(toggle, 'click', event => { event.preventDefault(); navigation.set(!navigation.expanded); });
  listen(toggle, 'keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); navigation.set(true);
    const options = visible();
    options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus({ preventScroll: true });
  });
  listen(document, 'pointerdown', event => { if (navigation.expanded && !menu.contains(event.target)) close(); });
  listen(menu, 'focusout', event => { if (navigation.expanded && event.relatedTarget && !menu.contains(event.relatedTarget)) close(); });
  listen(menu, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !navigation.expanded) return;
    if (['Escape', 'ArrowLeft'].includes(event.key) && nested.expanded && projects.contains(event.target)) {
      event.preventDefault(); nested.set(false, { focus: true }); return;
    }
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key === 'ArrowRight' && event.target === projectsToggle) {
      event.preventDefault(); nested.set(true); projects.querySelector('a')?.focus({ preventScroll: true }); return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = visible();
    const index = options.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    options[next]?.focus({ preventScroll: true });
  });
  listen(preference, 'change', () => {
    if (!preference.matches) return;
    navigation.set(navigation.expanded, { immediate: true });
    nested.set(nested.expanded, { immediate: true });
  });
  listen(window, 'resize', () => { if (navigation.animating) navigation.set(navigation.expanded, { immediate: true }); });
  const prepareExit = () => {
    navigation.set(false, { immediate: true });
    nested.set(false, { immediate: true });
  };
  listen(document, 'astro:before-preparation', prepareExit);
  listen(document, 'portfolio:preview-exit', prepareExit);
  listen(document, 'visibilitychange', () => {
    if (document.hidden && navigation.animating) navigation.set(navigation.expanded, { immediate: true });
  });
  return () => {
    controller.abort();
    navigation.set(false, { immediate: true });
    nested.set(false, { immediate: true });
  };
}

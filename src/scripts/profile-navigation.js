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
  const pageLinks = header.querySelector('.page-links');
  let linksHidden = null;
  function syncPageLinks() {
    if (!pageLinks) return;
    const hidden = window.scrollY > 8;
    if (hidden === linksHidden) return;
    if (hidden && pageLinks.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    linksHidden = hidden;
    pageLinks.dataset.scrolled = String(hidden);
    pageLinks.inert = hidden;
    pageLinks.setAttribute('aria-hidden', String(hidden));
  }
  window.addEventListener('scroll', syncPageLinks, { passive: true });
  window.addEventListener('pageshow', syncPageLinks);
  syncPageLinks();
  const nested = mountProjectMenu(projects, preference);
  const navigation = mountSiteMenu(menu, preference, { onChange: () => {
    toggle.setAttribute('aria-label', `${navigation.expanded ? 'Close' : 'Open'} navigation. ${header.dataset.page === 'about' ? 'About' : 'Home'}: ${header.dataset.owner}`);
  } });
  const choices = [...menu.querySelectorAll('a[href], [data-projects-toggle]')];
  const visible = () => choices.filter(choice => choice === projectsToggle || !projects.contains(choice) || nested.expanded);
  const close = (focus = false) => navigation.set(false, { focus });
  toggle.addEventListener('click', event => { event.preventDefault(); navigation.set(!navigation.expanded); });
  toggle.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation(); navigation.set(true);
    const options = visible();
    options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', event => { if (navigation.expanded && !menu.contains(event.target)) close(); });
  menu.addEventListener('focusout', event => { if (navigation.expanded && event.relatedTarget && !menu.contains(event.relatedTarget)) close(); });
  menu.addEventListener('keydown', event => {
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
  preference.addEventListener('change', () => {
    if (!preference.matches) return;
    navigation.set(navigation.expanded, { immediate: true });
    nested.set(nested.expanded, { immediate: true });
  });
  window.addEventListener('resize', () => { if (navigation.animating) navigation.set(navigation.expanded, { immediate: true }); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && navigation.animating) navigation.set(navigation.expanded, { immediate: true });
  });
}

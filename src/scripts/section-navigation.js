import { navigate } from 'astro:transitions/client';
import { mountPortfolio } from './carousel.js';
import { mountProfileNavigation } from './profile-navigation.js';
import { mountSectionLinks } from './section-links.js';
import { sectionDirection, sectionFromPath } from './section-state.js';
import { sectionTiming } from '../data/section-motion.js';
import { prepareGalleryImages } from './section-assets.js';
import { captureTouchSectionMotion, finishTouchSectionMotion, usesTouchSectionMotion } from './touch-section-motion.js';
import { projectSectionEntry } from './project-links.js';

let mountedHeader = null;
let dispose = () => {};
const projectEntryHandoffs = new WeakSet();

function mount({ fragment, sectionEntry = Boolean(window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__) } = {}) {
  const header = document.querySelector('.site-header');
  if (!header || header === mountedHeader) return;
  dispose();
  mountedHeader = header;
  const links = mountSectionLinks();
  const cleanup = header.dataset.page === 'projects'
    ? mountPortfolio({ sectionLinks: links, fragment, sectionEntry }) : mountProfileNavigation();
  dispose = () => { cleanup?.(); links.destroy(); mountedHeader = null; };
  if (window.__PORTFOLIO_PREVIEW_DIRECTION__) animatePreviewEntry(window.__PORTFOLIO_PREVIEW_DIRECTION__);
  return cleanup;
}

function animatePreviewEntry(direction) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const offset = direction * sectionTiming.distance;
  if (!window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__) document.querySelectorAll('[data-section-motion]').forEach(element => {
    // Add the short drift to the element's existing centering transform.
    const resting = getComputedStyle(element).transform;
    element.animate([{ opacity: 0, transform: `translateX(${offset}px) ${resting === 'none' ? '' : resting}` },
      { opacity: 1, transform: resting }], { duration: sectionTiming.enter, easing: sectionTiming.easing });
  });
  document.querySelectorAll('[data-section-fade]').forEach(element =>
    element.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: sectionTiming.enter, easing: sectionTiming.easing }));
  if (!window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__) document.querySelectorAll('[data-section-art]').forEach(element =>
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: sectionTiming.artwork, easing: 'linear' }));
  const menu = document.querySelector('.site-menu');
  const previous = window.__PORTFOLIO_PREVIEW_NAVIGATION__;
  if (menu && previous) {
    const transition = menu.style.transition;
    menu.style.transition = 'none';
    const next = getComputedStyle(menu);
    const palette = menu.animate([previous, { backgroundColor: next.backgroundColor, color: next.color }],
      { duration: sectionTiming.header, easing: 'linear' });
    palette.finished.catch(() => {}).then(() => { menu.style.transition = transition; });
  }
}

// The offline preview swaps frames instead of using Astro's document router.
// Give it the same exit phase, keeping navigation available for a newer choice.
if (window.__PORTFOLIO_PREVIEW_FRAGMENT__ !== undefined) {
  window.__PORTFOLIO_PREVIEW_EXIT__ = () => {
    document.dispatchEvent(new Event('portfolio:preview-exit'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    return Promise.allSettled([...document.querySelectorAll('[data-section-motion], [data-section-fade], [data-section-art]')].map(element =>
      element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }],
        { duration: element.matches('[data-section-art]') ? sectionTiming.artwork : sectionTiming.exit,
          easing: element.matches('[data-section-art]') ? 'linear' : 'ease-in', fill: 'forwards' }).finished));
  };
}

document.addEventListener('astro:before-preparation', event => {
  // Interrupt an entry with another live section handoff, rather than starting
  // a second snapshot transition while the first reveal is still settling.
  if (document.querySelector('#portfolio[data-section-project-entry]')) projectEntryHandoffs.add(event.signal);
  finishTouchSectionMotion();
  const loader = event.loader;
  event.loader = async () => {
    await loader();
    if (!event.signal.aborted) await prepareGalleryImages(event.newDocument, event.to, event.signal);
  };
  document.documentElement.toggleAttribute('data-gallery-handoff', Boolean(event.info?.gallerySwipe));
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  document.documentElement.style.setProperty('--section-drift', `${direction * sectionTiming.distance}px`);
});
document.addEventListener('astro:before-swap', event => {
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  const data = event.newDocument.getElementById('portfolio-data');
  const projectEntry = data && projectSectionEntry(event.from, event.to, JSON.parse(data.textContent)) >= 0;
  if (projectEntry) event.newDocument.getElementById('portfolio').setAttribute('data-section-project-entry', '');
  let startMotion;
  if (usesTouchSectionMotion() || projectEntry || projectEntryHandoffs.has(event.signal)) {
    // Keep the short drift on live elements, without relying on an incoming
    // browser snapshot being available to paint on touch devices.
    event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
    if (!event.info?.gallerySwipe && !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        document.querySelector('.site-header') && event.newDocument.querySelector('.site-header')) {
      startMotion = captureTouchSectionMotion(direction, { projectEntry });
    }
  }
  if (startMotion || projectEntry) {
    const swap = event.swap;
    event.swap = () => {
      swap();
      // Initialize the requested article before the first incoming paint. The
      // normal page-load event is too late and would expose the gallery first.
      const cleanup = projectEntry ? mount({ fragment: event.to.hash, sectionEntry: true }) : null;
      startMotion?.({ projectFinished: cleanup?.entryDone });
    };
  }
  // The fallback keeps the header anchored and blends its actual drawn colors.
  const menu = document.querySelector('.site-menu');
  const nextMenu = event.newDocument.querySelector('.site-menu');
  if (menu && nextMenu) {
    const style = getComputedStyle(menu);
    nextMenu.style.setProperty('--navigation-from-accent', style.backgroundColor);
    nextMenu.style.setProperty('--navigation-from-ink', style.color);
  }
  event.newDocument.documentElement.toggleAttribute('data-gallery-handoff', Boolean(event.info?.gallerySwipe));
  event.newDocument.documentElement.style.setProperty('--section-drift', `${direction * sectionTiming.distance}px`);
  dispose();
});
document.addEventListener('astro:page-load', mount);
document.addEventListener('portfolio:section-navigate', event => {
  const route = event.detail?.route;
  const link = document.querySelector(route === 'about' ? '[data-menu-about]' : '[data-menu-gallery]');
  if (!['about', 'projects'].includes(route) || !link) return;
  const gallerySwipe = Boolean(event.detail?.gallerySwipe);
  const fragment = event.detail?.fragment || '';
  const replace = Boolean(event.detail?.replace);
  if (!gallerySwipe) document.documentElement.removeAttribute('data-gallery-handoff');
  if (typeof window.__PORTFOLIO_PREVIEW_NAVIGATE__ === 'function') window.__PORTFOLIO_PREVIEW_NAVIGATE__(route, { gallerySwipe, fragment, replace });
  else {
    const url = new URL(link.href);
    url.hash = fragment;
    // Even a same-page hash navigation aborts Astro's pending About request.
    void navigate(url.href, { info: { gallerySwipe }, history: replace ? 'replace' : 'push' });
  }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();

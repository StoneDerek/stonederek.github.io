import { navigate } from 'astro:transitions/client';
import { mountPortfolio } from './carousel.js';
import { mountProfileNavigation } from './profile-navigation.js';
import { mountSectionLinks } from './section-links.js';
import { sectionDirection, sectionFromPath } from './section-state.js';

let mountedHeader = null;
let dispose = () => {};

function mount() {
  const header = document.querySelector('.site-header');
  if (!header || header === mountedHeader) return;
  dispose();
  mountedHeader = header;
  const links = mountSectionLinks();
  const cleanup = header.dataset.page === 'projects' ? mountPortfolio({ sectionLinks: links }) : mountProfileNavigation();
  dispose = () => { cleanup?.(); links.destroy(); mountedHeader = null; };
  if (window.__PORTFOLIO_PREVIEW_DIRECTION__) animatePreviewEntry(window.__PORTFOLIO_PREVIEW_DIRECTION__);
}

function animatePreviewEntry(direction) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const offset = direction * 12;
  document.querySelectorAll('[data-section-motion]').forEach(element => {
    // Add the short drift to the element's existing centering transform.
    const resting = getComputedStyle(element).transform;
    element.animate([{ opacity: 0, transform: `translateX(${offset}px) ${resting === 'none' ? '' : resting}` },
      { opacity: 1, transform: resting }], { duration: 180, easing: 'cubic-bezier(.22,.7,.2,1)' });
  });
  document.querySelector('.artwork-visual')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
}

document.addEventListener('astro:before-preparation', event => {
  document.documentElement.toggleAttribute('data-gallery-handoff', Boolean(event.info?.gallerySwipe));
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  document.documentElement.style.setProperty('--section-drift', `${direction * 12}px`);
});
document.addEventListener('astro:before-swap', event => {
  event.newDocument.documentElement.toggleAttribute('data-gallery-handoff', Boolean(event.info?.gallerySwipe));
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  event.newDocument.documentElement.style.setProperty('--section-drift', `${direction * 12}px`);
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

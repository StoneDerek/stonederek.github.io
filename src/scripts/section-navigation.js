import { mountPortfolio } from './carousel.js';
import { mountProfileNavigation } from './profile-navigation.js';
import { mountSectionLinks } from './section-links.js';
import { sectionDirection, sectionFromPath } from './section-state.js';
import { sectionTiming } from '../data/section-motion.js';
import { prepareGalleryImages } from './section-assets.js';
import { captureTouchSectionMotion, finishTouchSectionMotion } from './touch-section-motion.js';
import { projectSectionEntry } from './project-links.js';
import { mountTheme, appearanceEnabled } from './theme.js';
import { mountPublicationLabel } from './publication-label.js';

const theme = mountTheme({ enabled: appearanceEnabled });

let mountedHeader = null;
let dispose = () => {};

function mount({ fragment, sectionEntry = Boolean(window.__PORTFOLIO_PREVIEW_SECTION_PROJECT_ENTRY__) } = {}) {
  const header = document.querySelector('.site-header');
  if (!header || header === mountedHeader) return;
  dispose();
  mountedHeader = header;
  theme.refresh();
  const releasePublication = mountPublicationLabel();
  const links = mountSectionLinks();
  const cleanup = header.dataset.page === 'projects'
    ? mountPortfolio({ sectionLinks: links, fragment, sectionEntry }) : mountProfileNavigation();
  dispose = () => {
    cleanup?.(); links.destroy(); releasePublication(); mountedHeader = null;
  };
  return cleanup;
}

// The offline preview swaps frames instead of using Astro's document router.
// Its outer frame owns the blend; the outgoing document stays fully painted.
if (window.__PORTFOLIO_PREVIEW_FRAGMENT__ !== undefined) {
  window.__PORTFOLIO_PREVIEW_EXIT__ = () => {
    document.dispatchEvent(new Event('portfolio:preview-exit'));
  };
}

document.addEventListener('astro:before-preparation', event => {
  finishTouchSectionMotion();
  const loader = event.loader;
  event.loader = async () => {
    await loader();
    if (!event.signal.aborted) await prepareGalleryImages(event.newDocument, event.to, event.signal);
  };
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  document.documentElement.style.setProperty('--section-drift', `${direction * sectionTiming.distance}px`);
});
document.addEventListener('astro:before-swap', event => {
  const direction = sectionDirection(sectionFromPath(event.from.pathname), sectionFromPath(event.to.pathname));
  const data = event.newDocument.getElementById('portfolio-data');
  const projectEntry = data && projectSectionEntry(event.from, event.to, JSON.parse(data.textContent)) >= 0;
  if (projectEntry) event.newDocument.getElementById('portfolio').setAttribute('data-section-project-entry', '');
  let startMotion;
  // Use the same painted blend on every device. Some native implementations
  // omit the incoming drawing even after their ready promise has resolved.
  event.viewTransition.ready.catch(() => {});
  event.viewTransition.skipTransition();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      document.querySelector('.site-header') && event.newDocument.querySelector('.site-header')) {
    startMotion = captureTouchSectionMotion(direction, { projectEntry });
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
  event.newDocument.documentElement.style.setProperty('--section-drift', `${direction * sectionTiming.distance}px`);
  dispose();
});
document.addEventListener('astro:page-load', mount);
document.addEventListener('portfolio:theme-change', () => {
  finishTouchSectionMotion();
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();

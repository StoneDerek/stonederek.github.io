import { mountNavigationContrast } from './navigation-contrast.js';

export function mountSerifNavigation(root = document) {
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  const controller = new (view?.AbortController || AbortController)();
  const menus = [...root.querySelectorAll('[data-serif-menu]')];
  const releaseContrast = mountNavigationContrast(root.querySelector('.serif-navigation-desktop'));
  const site = root.querySelector('.serif-site');
  const updateFooterGeometry = () => {
    if (!site || !view) return;
    const left = site.getBoundingClientRect().left + (parseFloat(view.getComputedStyle(site).paddingLeft) || 0);
    site.style.setProperty('--layout-viewport-width', `${doc.documentElement.clientWidth || view.innerWidth}px`);
    site.style.setProperty('--site-content-left', `${left}px`);
  };
  updateFooterGeometry();
  view?.addEventListener('resize', updateFooterGeometry, { signal: controller.signal });

  for (const menu of menus) {
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      event.stopPropagation();
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }, { signal: controller.signal });
    menu.addEventListener('click', event => {
      if (event.target.closest?.('a[href]')) menu.open = false;
    }, { signal: controller.signal });
  }

  return () => { controller.abort(); releaseContrast(); };
}

import { mountNavigationContrast } from './navigation-contrast.js';

export function mountSerifNavigation(root = document) {
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  const controller = new (view?.AbortController || AbortController)();
  const menus = [...root.querySelectorAll('[data-serif-menu]')];
  const releaseContrast = mountNavigationContrast(root.querySelector('.serif-navigation-desktop'));
  const site = root.querySelector('.serif-site');
  const mobile = view?.matchMedia?.('(max-width: 879px)');
  const isMobile = () => mobile ? mobile.matches : (view?.innerWidth || 1024) < 880;
  const menuStates = [];
  let disposed = false;
  const listen = (target, type, handler, options) => target?.addEventListener(type, handler,
    { ...options, signal: controller.signal });
  const updateLayoutGeometry = () => {
    if (!site || !view) return;
    const bounds = site.getBoundingClientRect();
    const style = view.getComputedStyle(site);
    const width = doc.documentElement.clientWidth || view.innerWidth;
    site.style.setProperty('--layout-viewport-width', `${width}px`);
    site.style.setProperty('--site-content-left', `${bounds.left + (parseFloat(style.paddingLeft) || 0)}px`);
    site.style.setProperty('--site-content-right', `${Math.max(0, width - bounds.right + (parseFloat(style.paddingRight) || 0))}px`);
    site.style.setProperty('--site-content-top', `${parseFloat(style.paddingTop) || 0}px`);
  };
  updateLayoutGeometry();
  listen(view, 'resize', updateLayoutGeometry);

  for (const menu of menus) {
    const summary = menu.querySelector('summary');
    const menuSite = menu.closest('.serif-site') || site;
    let backgroundState = null;
    const restoreBackground = () => {
      if (!backgroundState) return;
      for (const [element, inert] of backgroundState) element.inert = inert;
      backgroundState = null;
    };
    const sync = () => {
      if (disposed) return;
      if (!isMobile()) menu.open = false;
      if (!menu.open) { restoreBackground(); return; }
      if (!backgroundState) {
        const background = [...(menuSite?.children || [])].filter(element => !element.contains(menu));
        backgroundState = new Map(background.map(element => [element, Boolean(element.inert)]));
        for (const element of background) element.inert = true;
      }
      if (!menu.contains(doc.activeElement)) summary?.focus({ preventScroll: true });
    };
    const close = ({ restoreFocus = true } = {}) => {
      menu.open = false;
      sync();
      if (restoreFocus && isMobile()) summary?.focus({ preventScroll: true });
    };
    const onViewportChange = () => {
      if (disposed || isMobile() || !menu.open) return;
      const focused = menu.contains(doc.activeElement);
      const href = doc.activeElement?.closest?.('a[href]')?.getAttribute('href');
      close({ restoreFocus: false });
      if (focused) {
        const desktopLinks = [...(menuSite?.querySelectorAll('.serif-navigation-desktop a[href]') || [])];
        const destination = desktopLinks.find(link => href && link.getAttribute('href') === href) ||
          desktopLinks.find(link => link.getAttribute('aria-current') === 'page') || desktopLinks[0];
        destination?.focus({ preventScroll: true });
      }
    };
    listen(menu, 'toggle', sync);
    listen(menu, 'keydown', event => {
      if (!menu.open) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(); return;
      }
      if (event.key !== 'Tab' || !isMobile() || event.ctrlKey || event.metaKey || event.altKey) return;
      const links = [...menu.querySelectorAll('.serif-navigation-mobile a[href]')]
        .filter(link => link.tabIndex >= 0 && !link.closest('[hidden], [inert]') && link.getAttribute('aria-disabled') !== 'true');
      const focusable = [summary, ...links].filter(Boolean);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) return;
      const outside = !focusable.includes(doc.activeElement);
      if (event.shiftKey && (doc.activeElement === first || outside)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (doc.activeElement === last || outside)) {
        event.preventDefault(); first.focus({ preventScroll: true });
      }
    });
    listen(menu, 'click', event => {
      if (event.target.closest?.('[data-serif-menu-backdrop]')) close();
      else if (event.target.closest?.('a[href]')) close({ restoreFocus: false });
      else if (event.target.closest?.('summary') === summary) Promise.resolve().then(sync);
    });
    listen(mobile, 'change', onViewportChange);
    listen(view, 'resize', onViewportChange);
    menuStates.push({ menu, restoreBackground });
    sync();
  }

  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    for (const { menu, restoreBackground } of menuStates) { menu.open = false; restoreBackground(); }
    releaseContrast();
  };
}

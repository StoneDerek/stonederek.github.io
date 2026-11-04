export function mountSerifNavigation(root = document) {
  const doc = root.ownerDocument || root;
  const view = doc.defaultView;
  const controller = new (view?.AbortController || AbortController)();
  const menus = [...root.querySelectorAll('[data-serif-menu]')];

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

  return () => controller.abort();
}

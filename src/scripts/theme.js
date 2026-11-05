export const themeStorageKey = 'derek-stone-theme';
export const appearanceEnabled = true;

// This function also runs inline in <head>, before the first page can paint.
// Keep it self-contained so the static and offline pages use the same startup.
export function initializeTheme(key = 'derek-stone-theme', enabled = true) {
  const valid = value => ['system', 'light', 'dark'].includes(value);
  let choice = window.__PORTFOLIO_THEME_STATE__?.choice || 'system';
  try {
    const saved = window.localStorage.getItem(key);
    if (enabled && valid(saved)) choice = saved;
  } catch { /* Private/file contexts still retain this document's choice. */ }
  if (enabled && valid(window.__PORTFOLIO_PREVIEW_THEME_CHOICE__)) choice = window.__PORTFOLIO_PREVIEW_THEME_CHOICE__;
  if (!enabled) choice = 'light';
  let systemDark = false;
  try { systemDark = Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches); } catch {}
  if (typeof window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__ === 'boolean') systemDark = window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__;
  const resolved = choice === 'system' ? systemDark ? 'dark' : 'light' : choice;
  window.__PORTFOLIO_THEME_STATE__ = { choice, resolved };
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = choice;
  const color = document.querySelector('meta[name="theme-color"]');
  if (color) color.content = resolved === 'dark' ? '#17171b' : '#ffffff';
  return window.__PORTFOLIO_THEME_STATE__;
}

export function mountTheme({ enabled = true } = {}) {
  if (!enabled) {
    initializeTheme(themeStorageKey, false);
    return { refresh: () => initializeTheme(themeStorageKey, false) };
  }
  let state = window.__PORTFOLIO_THEME_STATE__ || initializeTheme(themeStorageKey);
  const controller = new AbortController();
  const listen = (target, type, handler) => target?.addEventListener?.(type, handler, { signal: controller.signal });
  let disposed = false;
  let media;
  try { media = window.matchMedia?.('(prefers-color-scheme: dark)'); } catch {}
  const resolve = choice => choice === 'system'
    ? (window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__ ?? media?.matches) ? 'dark' : 'light' : choice;
  function chrome(doc = document) {
    doc.documentElement.dataset.theme = state.resolved;
    doc.documentElement.dataset.themePreference = state.choice;
    const color = doc.querySelector('meta[name="theme-color"]');
    if (color) color.content = state.resolved === 'dark' ? '#17171b' : '#ffffff';
    doc.querySelectorAll('[data-theme-control]').forEach(control => {
      control.hidden = false;
      const toggle = control.matches?.('[data-theme-switch]') ? control : control.querySelector('[data-theme-switch]');
      toggle?.setAttribute('aria-checked', String(state.resolved === 'dark'));
      const action = control.querySelector('[data-theme-action]');
      if (action) action.textContent = state.resolved === 'dark' ? 'Light mode' : 'Dark mode';
      const status = control.querySelector('[data-theme-status]');
      if (status) status.textContent = state.choice === 'system' ? 'Following system' : 'Saved preference';
      const system = control.querySelector('[data-theme-system]');
      if (system) system.hidden = state.choice === 'system';
    });
  }
  function apply(choice = state.choice, remember = false) {
    if (disposed) return;
    const previous = state.resolved;
    state = { choice, resolved: resolve(choice) };
    window.__PORTFOLIO_THEME_STATE__ = state;
    if (remember) {
      try {
        if (choice === 'system') window.localStorage.removeItem(themeStorageKey);
        else window.localStorage.setItem(themeStorageKey, choice);
      } catch {}
    }
    chrome();
    window.__PORTFOLIO_PREVIEW_SET_THEME__?.(state);
    if (previous !== state.resolved) document.dispatchEvent(new CustomEvent('portfolio:theme-change', { detail: state }));
  }
  listen(document, 'click', event => {
    if (event.target.closest('[data-theme-switch]')) apply(state.resolved === 'dark' ? 'light' : 'dark', true);
    else if (event.target.closest('[data-theme-system]')) apply('system', true);
  });
  listen(media, 'change', () => { if (state.choice === 'system') apply(); });
  listen(document, 'portfolio:preview-system-change', () => { if (state.choice === 'system') apply(); });
  listen(window, 'storage', event => {
    if (event.key === themeStorageKey || event.key === null) {
      apply(['light', 'dark'].includes(event.newValue) ? event.newValue : 'system');
    }
  });
  listen(document, 'astro:before-swap', event => chrome(event.newDocument));
  listen(document, 'astro:page-load', () => apply());
  listen(window, 'pageshow', () => apply());
  apply();
  return { refresh: () => apply(), destroy() { if (disposed) return; disposed = true; controller.abort(); } };
}

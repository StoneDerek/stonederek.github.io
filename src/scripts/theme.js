export const themeStorageKey = 'derek-stone-theme';
// Appearance modes are deferred while the light site and its content take shape.
export const appearanceEnabled = false;

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
  const icon = document.querySelector('[data-project-favicon]');
  if (icon && icon.dataset.themeLightFavicon !== icon.dataset.themeDarkFavicon) {
    icon.href = resolved === 'dark' ? icon.dataset.themeDarkFavicon : icon.dataset.themeLightFavicon;
  }
  return window.__PORTFOLIO_THEME_STATE__;
}

export function mountTheme({ enabled = true } = {}) {
  if (!enabled) {
    initializeTheme(themeStorageKey, false);
    return { refresh: () => initializeTheme(themeStorageKey, false) };
  }
  let state = window.__PORTFOLIO_THEME_STATE__ || initializeTheme(themeStorageKey);
  let media;
  try { media = window.matchMedia?.('(prefers-color-scheme: dark)'); } catch {}
  const resolve = choice => choice === 'system'
    ? (window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__ ?? media?.matches) ? 'dark' : 'light' : choice;
  function chrome(doc = document) {
    doc.documentElement.dataset.theme = state.resolved;
    doc.documentElement.dataset.themePreference = state.choice;
    const color = doc.querySelector('meta[name="theme-color"]');
    if (color) color.content = state.resolved === 'dark' ? '#17171b' : '#ffffff';
    const icon = doc.querySelector('[data-project-favicon]');
    // Gallery icons follow their selected project, rather than the page theme.
    if (icon && icon.dataset.themeLightFavicon !== icon.dataset.themeDarkFavicon) {
      icon.href = state.resolved === 'dark' ? icon.dataset.themeDarkFavicon : icon.dataset.themeLightFavicon;
    }
    doc.querySelectorAll('[data-theme-control]').forEach(control => {
      control.hidden = false;
      control.querySelector('[data-theme-switch]').setAttribute('aria-checked', String(state.resolved === 'dark'));
      control.querySelector('[data-theme-status]').textContent = state.choice === 'system' ? 'Following system' : 'Saved preference';
      control.querySelector('[data-theme-system]').hidden = state.choice === 'system';
    });
  }
  function apply(choice = state.choice, remember = false) {
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
  document.addEventListener('click', event => {
    if (event.target.closest('[data-theme-switch]')) apply(state.resolved === 'dark' ? 'light' : 'dark', true);
    else if (event.target.closest('[data-theme-system]')) apply('system', true);
  });
  media?.addEventListener('change', () => { if (state.choice === 'system') apply(); });
  document.addEventListener('portfolio:preview-system-change', () => { if (state.choice === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === themeStorageKey || event.key === null) {
      apply(['light', 'dark'].includes(event.newValue) ? event.newValue : 'system');
    }
  });
  document.addEventListener('astro:before-swap', event => chrome(event.newDocument));
  document.addEventListener('astro:page-load', () => apply());
  window.addEventListener('pageshow', () => apply());
  apply();
  return { refresh: () => apply() };
}

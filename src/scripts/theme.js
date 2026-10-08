// This self-contained function also runs inline in <head>, before first paint.
// Keep storage and media-query access guarded for private/offline browsers.
export function themeBootstrap() {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('portfolio-color-theme');
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {}
  const preview = window.__PORTFOLIO_PREVIEW_THEME_PREFERENCE__;
  if (preview === 'light' || preview === 'dark' || preview === 'system') preference = preview;
  let dark = false;
  try { dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch {}
  const theme = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#17151b' : '#ffffff';
}

export function resolveTheme(preference, systemDark = false) {
  return preference === 'light' || preference === 'dark' ? preference : systemDark ? 'dark' : 'light';
}

let initialized = false;
export function initializeTheme() {
  if (initialized) return;
  initialized = true;
  let media = null;
  try { media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch {}
  const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let preference = valid(document.documentElement.dataset.themePreference);
  const apply = (doc = document, { notify = false } = {}) => {
    const theme = resolveTheme(preference, media?.matches);
    const previous = doc.documentElement.dataset.theme;
    doc.documentElement.dataset.theme = theme;
    doc.documentElement.dataset.themePreference = preference;
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#17151b' : '#ffffff';
    doc.querySelectorAll('[data-theme-toggle]').forEach(button => button.setAttribute('aria-checked', String(theme === 'dark')));
    doc.querySelectorAll('[data-theme-reset]').forEach(button => { button.hidden = preference === 'system'; });
    doc.querySelectorAll('[data-theme-status]').forEach(label => {
      label.textContent = preference === 'system' ? 'Following your system' : `${theme === 'dark' ? 'Dark' : 'Light'} mode selected`;
    });
    doc.querySelectorAll('[data-theme-control]').forEach(control => { control.hidden = false; });
    if (notify && doc === document) {
      if (previous !== theme) document.dispatchEvent(new CustomEvent('portfolio:theme-change', { detail: { theme } }));
      if (window.__PORTFOLIO_PREVIEW_FRAGMENT__ !== undefined)
        window.parent.postMessage({ type: 'portfolio-preview-theme', theme, preference }, '*');
    }
  };
  const choose = value => {
    preference = valid(value);
    try {
      if (preference === 'system') localStorage.removeItem('portfolio-color-theme');
      else localStorage.setItem('portfolio-color-theme', preference);
    } catch {}
    apply(document, { notify: true });
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-theme-toggle]')) choose(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    else if (event.target.closest('[data-theme-reset]')) choose('system');
  });
  media?.addEventListener?.('change', () => { if (preference === 'system') apply(document, { notify: true }); });
  window.addEventListener('storage', event => {
    if (event.key !== 'portfolio-color-theme' && event.key !== null) return;
    preference = valid(event.newValue);
    apply(document, { notify: true });
  });
  document.addEventListener('astro:before-swap', event => apply(event.newDocument));
  document.addEventListener('astro:after-swap', () => apply());
  window.addEventListener('pageshow', () => {
    if (window.__PORTFOLIO_PREVIEW_FRAGMENT__ === undefined) {
      try { preference = valid(localStorage.getItem('portfolio-color-theme')); } catch {}
    }
    apply(document, { notify: true });
  });
  apply();
}

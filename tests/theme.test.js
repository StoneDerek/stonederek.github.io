import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { initializeTheme, mountTheme, themeStorageKey } from '../src/scripts/theme.js';

function bootstrap({ saved = null, dark = false, blocked = false, preview, previewSystem, mediaMissing = false, enabled = true } = {}) {
  const meta = {}, icon = { dataset: { themeLightFavicon: 'light-icon', themeDarkFavicon: 'dark-icon' } };
  const document = { documentElement: { dataset: {} }, querySelector: selector => selector.includes('meta') ? meta : icon };
  const window = { localStorage: { getItem() { if (blocked) throw new Error('blocked'); return saved; } },
    ...(mediaMissing ? {} : { matchMedia: () => ({ matches: dark }) }), __PORTFOLIO_PREVIEW_THEME_CHOICE__: preview, __PORTFOLIO_PREVIEW_SYSTEM_DARK__: previewSystem };
  const context = vm.createContext({ window, document });
  vm.runInContext(`(${initializeTheme.toString()})(undefined,${enabled});`, context);
  return { window, document, meta, icon, context };
}

test('the inline startup resolves system and saved preferences before painting', () => {
  for (const saved of [null, 'invalid', 'system', 'light', 'dark']) for (const dark of [false, true]) {
    const s = bootstrap({ saved, dark });
    const expected = ['light', 'dark'].includes(saved) ? saved : dark ? 'dark' : 'light';
    assert.equal(s.document.documentElement.dataset.theme, expected);
    assert.equal(s.meta.content, expected === 'dark' ? '#17171b' : '#ffffff');
    assert.equal(s.icon.href, `${expected}-icon`);
  }
});

test('deferred appearance stays light despite saved, system, or preview dark preferences', () => {
  for (const blocked of [false, true]) {
    const s = bootstrap({ saved: 'dark', dark: true, preview: 'dark', previewSystem: true, blocked, enabled: false });
    assert.equal(s.document.documentElement.dataset.theme, 'light');
    assert.equal(s.document.documentElement.dataset.themePreference, 'light');
    assert.equal(s.meta.content, '#ffffff');
    assert.equal(s.icon.href, 'light-icon');
  }
});

test('missing preference APIs fall back to light and denied storage preserves an in-memory or preview override', () => {
  const missing = bootstrap({ blocked: true, mediaMissing: true });
  assert.equal(missing.document.documentElement.dataset.theme, 'light');
  missing.window.__PORTFOLIO_THEME_STATE__.choice = 'dark';
  vm.runInContext(`(${initializeTheme.toString()})();`, missing.context);
  assert.equal(missing.document.documentElement.dataset.theme, 'dark');
  const preview = bootstrap({ saved: 'light', preview: 'dark', blocked: true });
  assert.equal(preview.document.documentElement.dataset.theme, 'dark');
});

test('offline system following uses the outer preference rather than the iframe color-scheme', () => {
  assert.equal(bootstrap({ dark: false, preview: 'system', previewSystem: true }).document.documentElement.dataset.theme, 'dark');
  const s = scene();
  try {
    s.window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__ = true;
    s.document.dispatchEvent(new Event('portfolio:preview-system-change'));
    assert.equal(s.document.documentElement.dataset.theme, 'dark');
    s.click('[data-theme-switch]');
    s.window.__PORTFOLIO_PREVIEW_SYSTEM_DARK__ = false;
    s.document.dispatchEvent(new Event('portfolio:preview-system-change'));
    assert.equal(s.document.documentElement.dataset.themePreference, 'light');
    s.click('[data-theme-system]');
    assert.equal(s.document.documentElement.dataset.themePreference, 'system');
    assert.equal(s.document.documentElement.dataset.theme, 'light');
  } finally { s.restore(); }
});

function scene({ blocked = false } = {}) {
  const names = ['document', 'window', 'CustomEvent'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const document = new EventTarget(), window = new EventTarget(), media = new EventTarget();
  const saved = new Map(); media.matches = false;
  const toggle = { setAttribute(name, value) { this[name] = value; } }, status = {}, reset = {};
  const control = { hidden: true, querySelector: name => name === '[data-theme-switch]' ? toggle : name === '[data-theme-status]' ? status : reset };
  const meta = {};
  document.documentElement = { dataset: {} };
  document.querySelector = selector => selector.includes('meta') ? meta : null;
  document.querySelectorAll = () => [control];
  window.matchMedia = () => media;
  window.__PORTFOLIO_THEME_STATE__ = { choice: 'system', resolved: 'light' };
  window.localStorage = { setItem(key, value) { if (blocked) throw new Error('blocked'); saved.set(key, value); },
    removeItem(key) { if (blocked) throw new Error('blocked'); saved.delete(key); } };
  const message = []; window.__PORTFOLIO_PREVIEW_SET_THEME__ = state => message.push(state);
  Object.assign(globalThis, { document, window, CustomEvent: class extends Event { constructor(name, options) { super(name); this.detail = options.detail; } } });
  mountTheme();
  return { document, window, media, saved, control, toggle, status, reset, message,
    click(selector) { const event = new Event('click'); Object.defineProperty(event, 'target', { value: { closest: name => name === selector } }); document.dispatchEvent(event); },
    restore() { for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } }
  };
}

test('the switch remembers an override, ignores system changes, and Use system restores following', () => {
  const s = scene();
  try {
    s.click('[data-theme-switch]');
    assert.equal(s.document.documentElement.dataset.theme, 'dark');
    assert.equal(s.saved.get(themeStorageKey), 'dark'); assert.equal(s.toggle['aria-checked'], 'true');
    assert.equal(s.reset.hidden, false);
    s.media.dispatchEvent(new Event('change'));
    assert.equal(s.document.documentElement.dataset.theme, 'dark');
    s.click('[data-theme-system]');
    assert.equal(s.document.documentElement.dataset.theme, 'light'); assert.equal(s.saved.has(themeStorageKey), false);
    s.media.matches = true; s.media.dispatchEvent(new Event('change'));
    assert.equal(s.document.documentElement.dataset.theme, 'dark'); assert.equal(s.reset.hidden, true);
  } finally { s.restore(); }
});

test('incoming documents and offline frames receive the chosen theme even with denied storage', () => {
  const s = scene({ blocked: true });
  try {
    s.click('[data-theme-switch]');
    const next = { documentElement: { dataset: {} }, querySelector: () => null, querySelectorAll: () => [] };
    const swap = new Event('astro:before-swap'); swap.newDocument = next; s.document.dispatchEvent(swap);
    assert.equal(next.documentElement.dataset.theme, 'dark');
    assert.equal(next.documentElement.dataset.themePreference, 'dark');
    assert.equal(s.message.at(-1).choice, 'dark');
    assert.equal(s.control.hidden, false);
  } finally { s.restore(); }
});

test('changes in another tab update controls without writing the preference back', () => {
  const s = scene();
  try {
    const event = new Event('storage'); event.key = themeStorageKey; event.newValue = 'dark'; s.window.dispatchEvent(event);
    assert.equal(s.document.documentElement.dataset.theme, 'dark'); assert.equal(s.saved.size, 0);
    const clear = new Event('storage'); clear.key = null; clear.newValue = null; s.window.dispatchEvent(clear);
    assert.equal(s.document.documentElement.dataset.themePreference, 'system');
    assert.equal(s.document.documentElement.dataset.theme, 'light');
  } finally { s.restore(); }
});

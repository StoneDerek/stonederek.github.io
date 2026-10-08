import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { resolveTheme, themeBootstrap } from '../src/scripts/theme.js';
import { ASCII_COLORS, ASCII_DARK_COLORS } from '../src/scripts/ascii-grid.js';

test('explicit choices override the system; an absent or unknown preference falls back to light', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('unknown'), 'light');
});

test('the first-paint bootstrap works without imported helpers or storage/media access', () => {
  const boot = ({ stored, dark = false, blocked = false, mediaMissing = false, preview } = {}) => {
    const document = { documentElement: { dataset: {} }, querySelector: () => null };
    const window = { __PORTFOLIO_PREVIEW_THEME_PREFERENCE__: preview };
    if (!mediaMissing) window.matchMedia = () => ({ matches: dark });
    vm.runInNewContext(`(${themeBootstrap.toString()})();`, {
      document, window, localStorage: { getItem() { if (blocked) throw new Error('Storage unavailable'); return stored; } }
    });
    return document.documentElement.dataset;
  };
  assert.deepEqual(boot({ dark: true }), { theme: 'dark', themePreference: 'system' });
  assert.deepEqual(boot({ stored: 'light', dark: true }), { theme: 'light', themePreference: 'light' });
  assert.deepEqual(boot({ blocked: true, dark: true }), { theme: 'dark', themePreference: 'system' });
  assert.deepEqual(boot({ blocked: true, mediaMissing: true }), { theme: 'light', themePreference: 'system' });
  assert.deepEqual(boot({ stored: 'invalid' }), { theme: 'light', themePreference: 'system' });
  assert.deepEqual(boot({ blocked: true, preview: 'dark' }), { theme: 'dark', themePreference: 'dark' });
});

test('dark ASCII output preserves color indices while making every puzzle ink visible', () => {
  assert.equal(ASCII_DARK_COLORS.length, ASCII_COLORS.length);
  const luminance = color => [1, 3, 5].reduce((sum, start, i) => {
    const c = parseInt(color.slice(start, start + 2), 16) / 255;
    return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
  }, 0);
  const background = luminance('#17151b');
  for (const ink of ASCII_DARK_COLORS) assert.ok((luminance(ink) + .05) / (background + .05) >= 4.5);
});

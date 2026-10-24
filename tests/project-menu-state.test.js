import test from 'node:test';
import assert from 'node:assert/strict';
import { projectMenuPreference } from '../src/scripts/project-menu-state.js';

function storage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; }
test('open and closed states override page-specific defaults after navigation/reload', () => {
  const sessionStorage = storage();
  const home = projectMenuPreference({ sessionStorage });
  home.write(true);
  assert.equal(projectMenuPreference({ sessionStorage }).read(false), true);
  home.write(false);
  assert.equal(projectMenuPreference({ sessionStorage }).read(true), false);
});
test('the persistent offline app shares its outer document preference', () => {
  const parent = { sessionStorage: storage() };
  const frame = () => projectMenuPreference({ __PORTFOLIO_PREVIEW_ADDRESS__: '/', parent });
  frame().write(true); assert.equal(frame().read(false), true);
  frame().write(false); assert.equal(frame().read(true), false);
});
test('blocked storage keeps a usable in-session preference without throwing', () => {
  const scope = { get sessionStorage() { throw new Error('Storage blocked'); } };
  const preference = projectMenuPreference(scope);
  assert.equal(preference.read(false), false);
  preference.write(true); assert.equal(projectMenuPreference(scope).read(false), true);
});
test('an opaque preview parent cannot prevent startup or remembering the menu state', () => {
  const parent = new Proxy({}, {
    get() { throw new DOMException('Cross-origin parent access', 'SecurityError'); },
    set() { throw new DOMException('Cross-origin parent access', 'SecurityError'); }
  });
  const scope = { __PORTFOLIO_PREVIEW_ADDRESS__: '/', parent,
    get sessionStorage() { throw new DOMException('Storage blocked', 'SecurityError'); } };
  const preference = projectMenuPreference(scope);
  assert.equal(preference.read(false), false);
  preference.write(true);
  assert.equal(projectMenuPreference(scope).read(false), true);
  preference.write(false);
  assert.equal(projectMenuPreference(scope).read(true), false);
});
test('a direct preview uses its own menu state even when its host is accessible', () => {
  const parent = { sessionStorage: storage(), __PORTFOLIO_PROJECTS_EXPANDED__: false };
  const scope = { parent, sessionStorage: storage(), __PORTFOLIO_PREVIEW_ADDRESS__: '/',
    __PORTFOLIO_PREVIEW_SET_ADDRESS__() {} };
  projectMenuPreference(scope).write(true);
  assert.equal(projectMenuPreference(scope).read(false), true);
  assert.equal(parent.__PORTFOLIO_PROJECTS_EXPANDED__, false);
});

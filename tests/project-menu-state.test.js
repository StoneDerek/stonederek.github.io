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
test('fresh offline frames share the parent preference', () => {
  const parent = { sessionStorage: storage() };
  const frame = () => projectMenuPreference({ __PORTFOLIO_PREVIEW_FRAGMENT__: '', parent });
  frame().write(true); assert.equal(frame().read(false), true);
  frame().write(false); assert.equal(frame().read(true), false);
});
test('blocked storage keeps a usable in-session preference without throwing', () => {
  const scope = { get sessionStorage() { throw new Error('Storage blocked'); } };
  const preference = projectMenuPreference(scope);
  assert.equal(preference.read(false), false);
  preference.write(true); assert.equal(projectMenuPreference(scope).read(false), true);
});

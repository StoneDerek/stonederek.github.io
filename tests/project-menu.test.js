import test from 'node:test';
import assert from 'node:assert/strict';
import { mountProjectMenu } from '../src/scripts/project-menu.js';

test('page-exit cleanup closes the old DOM without erasing the shared expansion preference', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    sessionStorage: { getItem() { return null; }, setItem() {} }
  } });
  const first = scene({ persist: true });
  try {
    first.navigation.set(true, { immediate: true });
    first.navigation.set(false, { immediate: true, remember: false });
    first.events.get('toggle')();
    assert.equal(window.__PORTFOLIO_PROJECTS_EXPANDED__, true);
  } finally { first.restore(); }
  const next = scene({ persist: true });
  try {
    assert.equal(next.navigation.expanded, true);
    assert.equal(next.details.open, true);
    assert.equal(next.panel.inert, false);
  } finally {
    next.restore();
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete globalThis.window;
  }
});

function scene({ reduced = false, supported = true, persist = false } = {}) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const styleDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  const animations = [];
  const events = new Map();
  const toggle = { attributes: new Map(), addEventListener: (name, callback) => events.set(name, callback),
    setAttribute(name, value) { this.attributes.set(name, value); },
    focus() { document.activeElement = toggle; } };
  const item = {};
  const panel = { style: { height: '' }, scrollHeight: 280, measuredHeight: 0, opacity: '0',
    contains: node => node === item,
    getBoundingClientRect() { return { height: this.measuredHeight }; } };
  if (supported) panel.animate = (frames, options) => {
    const animation = { frames, options, onfinish: null, cancelled: false,
      cancel() { this.cancelled = true; }, finish() { this.onfinish?.(); } };
    animations.push(animation);
    return animation;
  };
  const details = { open: false, dataset: {},
    querySelector: selector => selector === '[data-projects-toggle]' ? toggle : panel,
    addEventListener: (name, callback) => events.set(name, callback) };
  Object.assign(globalThis, { document: { activeElement: null }, getComputedStyle: node => ({ opacity: node.opacity }) });
  const preference = { matches: reduced };
  const navigation = mountProjectMenu(details, preference, { persist });
  return { details, toggle, panel, item, navigation, animations, events, preference,
    restore() {
      if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
      else delete globalThis.document;
      if (styleDescriptor) Object.defineProperty(globalThis, 'getComputedStyle', styleDescriptor);
      else delete globalThis.getComputedStyle;
    } };
}

test('opening Projects exposes its links and finishes at natural height', () => {
  const s = scene();
  try {
    s.navigation.set(true);
    assert.equal(s.details.open, true);
    assert.equal(s.navigation.expanded, true);
    assert.equal(s.toggle.attributes.get('aria-expanded'), 'true');
    assert.equal(s.panel.inert, false);
    assert.deepEqual(s.animations[0].frames.map(frame => frame.height), ['0px', '280px']);
    s.animations[0].finish();
    assert.equal(s.panel.style.height, '');
    assert.equal(s.animations[0].cancelled, true);
    assert.equal(s.details.open, true);
  } finally { s.restore(); }
});

test('closing Projects moves focus out before disabling its links', () => {
  const s = scene();
  try {
    s.navigation.set(true, { immediate: true });
    s.panel.measuredHeight = 280;
    s.panel.opacity = '1';
    document.activeElement = s.item;
    s.navigation.set(false);
    assert.equal(document.activeElement, s.toggle);
    assert.equal(s.panel.inert, true);
    assert.equal(s.toggle.attributes.get('aria-expanded'), 'false');
    assert.equal(s.details.open, true, 'retain contents until their collapse finishes');
    s.animations[0].finish();
    assert.equal(s.details.open, false);
    assert.equal(s.panel.style.height, '');
  } finally { s.restore(); }
});

test('rapid reversal continues from the drawn height and ignores stale completion', () => {
  const s = scene();
  try {
    s.navigation.set(true);
    const staleFinish = s.animations[0].onfinish;
    s.panel.measuredHeight = 118;
    s.panel.opacity = '.5';
    s.navigation.set(false);
    assert.equal(s.animations[0].cancelled, true);
    assert.equal(s.animations[1].frames[0].height, '118px');
    assert.equal(s.animations[1].frames[0].opacity, '.5');
    s.panel.measuredHeight = 62;
    s.navigation.set(true);
    staleFinish();
    assert.equal(s.navigation.expanded, true);
    assert.equal(s.details.open, true);
    assert.equal(s.animations[2].frames[0].height, '62px');
    s.animations[2].finish();
    assert.equal(s.details.dataset.expanded, 'true');
    assert.equal(s.panel.style.height, '');
  } finally { s.restore(); }
});

for (const options of [{ reduced: true }, { supported: false }]) {
  test(`Projects remains usable with ${options.reduced ? 'reduced motion' : 'no animation API'}`, () => {
    const s = scene(options);
    try {
      s.navigation.set(true);
      assert.equal(s.details.open, true);
      assert.equal(s.panel.inert, false);
      s.navigation.set(false);
      assert.equal(s.details.open, false);
      assert.equal(s.panel.inert, true);
      assert.equal(s.animations.length, 0);
    } finally { s.restore(); }
  });
}

test('native toggles and a preference change keep expansion and focus in sync', () => {
  const s = scene();
  try {
    s.details.open = true;
    s.events.get('toggle')();
    assert.equal(s.navigation.expanded, true);
    assert.equal(s.panel.inert, false);
    s.panel.measuredHeight = 280;
    s.navigation.set(false);
    s.preference.matches = true;
    s.navigation.set(s.navigation.expanded, { immediate: true });
    assert.equal(s.details.open, false);
    assert.equal(s.animations[0].cancelled, true);
    assert.equal(s.panel.style.height, '');
  } finally { s.restore(); }
});

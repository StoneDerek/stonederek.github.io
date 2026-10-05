import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSiteMenu } from '../src/scripts/site-menu.js';

function scene({ reduced = false, unsupported = null } = {}) {
  const descriptors = ['document', 'getComputedStyle'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const events = new Map();
  const animations = [];
  const inertFocus = [];
  let activeHeight = null;
  const item = {};
  const toggle = {
    attributes: new Map(), setAttribute(name, value) { this.attributes.set(name, value); },
    getBoundingClientRect: () => ({ height: 64 }),
    focus() { document.activeElement = toggle; }
  };
  const body = {
    hidden: false, style: { opacity: '', transform: '' }, opacity: '1', transform: 'none',
    contains: node => node === item,
    set inert(value) { this.disabled = value; inertFocus.push(document.activeElement); },
    get inert() { return this.disabled; }
  };
  const details = {
    open: false, dataset: {}, style: { height: '', setProperty(name, value) { this[name] = value; } },
    querySelector: selector => selector === 'summary' ? toggle : body,
    addEventListener: (name, callback) => events.set(name, callback),
    getBoundingClientRect() {
      return { height: activeHeight?.drawnHeight ?? (parseFloat(this.style.height) || (this.open ? 800 : 64)) };
    }
  };
  for (const [name, node] of [['details', details], ['body', body]]) {
    if (name === unsupported) continue;
    node.animate = (frames, options) => {
      const animation = {
        frames, options, owner: name, drawnHeight: null, onfinish: null, cancelled: false,
        cancel() { this.cancelled = true; if (activeHeight === this) activeHeight = null; },
        finish() { this.onfinish?.(); }
      };
      if (name === 'details') activeHeight = animation;
      animations.push(animation);
      return animation;
    };
  }
  Object.assign(globalThis, {
    document: { activeElement: null }, getComputedStyle: node => ({ opacity: node.opacity, transform: node.transform })
  });
  const preference = { matches: reduced };
  let changes = 0;
  const navigation = mountSiteMenu(details, preference, { onChange: () => changes++ });
  return {
    details, toggle, body, item, navigation, animations, events, preference, inertFocus,
    get changes() { return changes; },
    restore() {
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  };
}

test('the complete menu body is hidden after closing and all animation fills are removed', () => {
  const s = scene();
  try {
    assert.equal(s.body.hidden, true);
    assert.equal(s.body.inert, true);
    s.navigation.set(true);
    assert.equal(s.body.hidden, false);
    assert.equal(s.body.inert, false);
    assert.deepEqual(s.animations[0].frames.map(frame => frame.height), ['64px', '800px']);
    s.animations[0].finish();
    assert.equal(s.details.style.height, '');
    s.navigation.set(false);
    assert.equal(s.details.open, true, 'keep native content available during collapse');
    assert.equal(s.body.hidden, false);
    assert.equal(s.body.inert, true);
    s.animations[2].finish();
    assert.equal(s.details.open, false);
    assert.equal(s.body.hidden, true, 'dividers must have no remaining paintable body');
    assert.equal(s.details.style.height, '');
    assert.equal(s.body.style.opacity, '');
    assert.equal(s.body.style.transform, '');
    assert.ok(s.animations.every(animation => animation.cancelled));
    assert.equal(s.navigation.animating, false);
  } finally { s.restore(); }
});

test('closing moves focus to the header before making menu links inert', () => {
  const s = scene();
  try {
    s.navigation.set(true, { immediate: true });
    document.activeElement = s.item;
    s.navigation.set(false);
    assert.equal(document.activeElement, s.toggle);
    assert.equal(s.inertFocus.at(-1), s.toggle);
    assert.equal(s.toggle.attributes.get('aria-expanded'), 'false');
    s.animations[0].finish();
    assert.equal(s.body.hidden, true);
  } finally { s.restore(); }
});

test('rapid reversals retain the drawn frame and stale completions cannot hide the reopened menu', () => {
  const s = scene();
  try {
    s.navigation.set(true);
    const staleOpen = s.animations[0].onfinish;
    s.animations[0].drawnHeight = 276;
    s.body.opacity = '.6';
    s.body.transform = 'matrix(1, 0, 0, 1, 0, -2)';
    s.navigation.set(false);
    const staleClose = s.animations[2].onfinish;
    assert.equal(s.animations[2].frames[0].height, '276px');
    assert.equal(s.animations[3].frames[0].opacity, '.6');
    assert.equal(s.animations[3].frames[0].transform, s.body.transform);
    s.animations[2].drawnHeight = 100;
    s.navigation.set(true);
    assert.equal(s.animations[4].frames[0].height, '100px');
    staleOpen();
    staleClose();
    assert.equal(s.details.open, true);
    assert.equal(s.body.hidden, false);
    assert.equal(s.navigation.expanded, true);
    s.animations[4].finish();
    s.navigation.set(false, { immediate: true });
    assert.equal(s.body.hidden, true);
    assert.ok(s.animations.every(animation => animation.cancelled));
  } finally { s.restore(); }
});

test('a motion preference change releases running effects and leaves a clean closed state', () => {
  const s = scene();
  try {
    s.navigation.set(true);
    s.preference.matches = true;
    s.navigation.set(s.navigation.expanded);
    assert.equal(s.details.open, true);
    assert.equal(s.body.hidden, false);
    assert.equal(s.navigation.animating, false);
    s.navigation.set(false);
    assert.equal(s.body.hidden, true);
    assert.equal(s.details.style.height, '');
    assert.ok(s.animations.every(animation => animation.cancelled));
  } finally { s.restore(); }
});

for (const unsupported of ['details', 'body']) {
  test(`the menu remains usable without the ${unsupported} animation API`, () => {
    const s = scene({ unsupported });
    try {
      s.navigation.set(true);
      assert.equal(s.details.open, true);
      assert.equal(s.body.hidden, false);
      s.navigation.set(false);
      assert.equal(s.details.open, false);
      assert.equal(s.body.hidden, true);
      assert.equal(s.animations.length, 0);
    } finally { s.restore(); }
  });
}

test('closing before the first moving frame still hides the body and clears the old effects', () => {
  const s = scene();
  try {
    s.navigation.set(true);
    s.navigation.set(false);
    assert.equal(s.details.open, false);
    assert.equal(s.body.hidden, true);
    assert.equal(s.details.style.height, '');
    assert.equal(s.navigation.animating, false);
    assert.ok(s.animations.every(animation => animation.cancelled));
  } finally { s.restore(); }
});

test('native toggles expose the body while nested disclosure events leave the main menu alone', () => {
  const s = scene();
  try {
    s.details.open = true;
    s.events.get('toggle')({ target: s.details });
    assert.equal(s.body.hidden, false);
    assert.equal(s.body.inert, false);
    assert.equal(s.navigation.expanded, true);
    const changes = s.changes;
    s.events.get('toggle')({ target: {} });
    assert.equal(s.changes, changes);
    s.details.open = false;
    s.events.get('toggle')({ target: s.details });
    assert.equal(s.body.hidden, true);
    assert.equal(s.body.inert, true);
    assert.equal(s.navigation.expanded, false);
  } finally { s.restore(); }
});

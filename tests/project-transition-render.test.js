import test from 'node:test';
import assert from 'node:assert/strict';
import { settleTiles } from '../src/scripts/project-transition.js';

// A controlled frame clock exercises the real animation without a browser binary.
// It checks render positions and cleanup, not browser-specific path rasterization.
function scene() {
  const names = ['CSS', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const frames = new Map();
  let nextFrame = 0;
  class Node {
    constructor() { this.style = { opacity: '', visibility: '' }; this.hidden = false; this.children = []; this.attributes = new Map(); }
    append(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    querySelectorAll() { return []; }
  }
  const root = new Node();
  const page = new Node();
  page.parentElement = { clientHeight: 568 };
  page.clientWidth = 305;
  page.scrollHeight = 1100;
  page.getBoundingClientRect = () => ({ left: 2.5, top: 0, width: 304.5, height: 1100 });
  page.cloneNode = () => {
    const copy = new Node();
    copy.style = { ...page.style };
    return copy;
  };
  const documentEvents = new EventTarget();
  Object.assign(globalThis, {
    CSS: { supports: () => true },
    document: {
      documentElement: { clientWidth: 320 }, createElement: () => new Node(), hidden: false,
      addEventListener: (...args) => documentEvents.addEventListener(...args),
      removeEventListener: (...args) => documentEvents.removeEventListener(...args),
      dispatchEvent: event => documentEvents.dispatchEvent(event)
    },
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    performance: { now: () => 0 }
  });
  return {
    root, page, frames,
    advance(time) {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback(time));
    },
    restore() {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  };
}

test('opening reveals tiles without displacing article text, then hands off at the same width', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const finished = settleTiles(s.root, s.page, { opening: true, origin: { x: .5, y: .5 }, signal: controller.signal });
    assert.equal(s.page.style.opacity, '0');
    const firstMask = s.root.children[0].style.clipPath;
    s.advance(150);
    assert.notEqual(s.root.children[0].style.clipPath, firstMask);
    for (const layer of s.root.children) {
      assert.ok(!layer.style.transform || layer.style.transform === 'none', 'the tile mask must not move the text with it');
      assert.equal(layer.children[0].style.left, '2.5px', 'the snapshot must preserve the article position');
      assert.equal(layer.children[0].style.width, '304.5px', 'the snapshot must preserve fractional layout widths');
      assert.ok(!layer.children[0].style.transform || layer.children[0].style.transform === 'none');
    }
    s.advance(400);
    assert.equal(s.page.style.opacity, '0');
    s.advance(700);
    await finished;
    assert.equal(s.page.style.opacity, '');
    assert.equal(s.root.children.length, 0);
    assert.equal(s.frames.size, 0);
  } finally { controller.abort(); s.restore(); }
});

test('interrupting an opening restores the article and removes every pending tile frame', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    s.page.style.opacity = '.8';
    const finished = settleTiles(s.root, s.page, { opening: true, signal: controller.signal });
    s.advance(120);
    controller.abort();
    await finished;
    assert.equal(s.page.style.opacity, '.8');
    assert.equal(s.root.children.length, 0);
    assert.equal(s.frames.size, 0);
  } finally { controller.abort(); s.restore(); }
});

test('closing a scrolled article captures that viewport and cleans up after the final frame', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const finished = settleTiles(s.root, s.page, { opening: false, scrollTop: 320, signal: controller.signal });
    const layer = s.root.children[0];
    assert.equal(layer.children[0].style.top, '-320px');
    assert.equal(layer.children[0].style.minHeight, '1100px');
    s.advance(100);
    assert.equal(s.page.style.opacity, '0');
    s.advance(450);
    await finished;
    assert.equal(s.page.style.opacity, '');
    assert.equal(s.root.children.length, 0);
    assert.equal(s.frames.size, 0);
  } finally { controller.abort(); s.restore(); }
});

test('opening cannot show the completed article while mounting or before the first tile frame', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const mounted = [];
    const append = s.root.append.bind(s.root);
    s.root.append = layer => {
      mounted.push({ sourceVisibility: s.page.style.visibility, snapshotHidden: layer.hidden, clip: layer.style.clipPath });
      append(layer);
    };
    const finished = settleTiles(s.root, s.page, { opening: true, origin: { x: .5, y: .5 }, signal: controller.signal });
    assert.equal(mounted[0].sourceVisibility, 'hidden', 'conceal the article before adding its snapshot');
    assert.equal(mounted[0].snapshotHidden, true, 'the snapshot must enter the DOM concealed');
    assert.equal(mounted[0].clip, 'inset(50%)', 'use an explicit empty clip instead of a degenerate SVG path');
    const layer = s.root.children[0];
    s.advance(0);
    assert.equal(layer.hidden, true, 'an empty first animation frame must stay concealed');
    assert.equal(s.page.style.visibility, 'hidden');
    s.advance(150);
    assert.equal(layer.hidden, false);
    assert.equal(layer.style.visibility, 'visible');
    assert.equal(layer.children[0].style.visibility, 'visible', 'the clone must not inherit the original concealment');
    assert.ok(layer.style.clipPath.startsWith('path('));
    assert.notEqual(layer.style.clipPath, 'path("M0 0Z")');
    s.advance(700);
    await finished;
    assert.equal(s.page.style.visibility, '');
  } finally { controller.abort(); s.restore(); }
});

test('closing starts fully covered so concealing the original does not expose the gallery', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const finished = settleTiles(s.root, s.page, { opening: false, signal: controller.signal });
    const layer = s.root.children[0];
    assert.equal(layer.hidden, false);
    assert.equal(layer.style.visibility, 'visible');
    assert.equal(layer.style.clipPath, 'inset(0)');
    assert.equal(s.page.style.visibility, 'hidden');
    s.advance(450);
    await finished;
    assert.equal(s.page.style.visibility, '');
    assert.equal(s.root.children.length, 0);
  } finally { controller.abort(); s.restore(); }
});

test('a 120 Hz display updates the mask at 60 Hz without stretching the transition', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const finished = settleTiles(s.root, s.page, { opening: true, signal: controller.signal });
    const layer = s.root.children[0];
    let draws = 0;
    let clip = layer.style.clipPath;
    Object.defineProperty(layer.style, 'clipPath', {
      get: () => clip,
      set: value => { clip = value; draws++; }
    });
    for (let frame = 1; frame <= 81; frame++) s.advance(frame * 1000 / 120);
    await finished;
    assert.equal(draws, 40, 'skip alternate expensive mask updates, including redundant final geometry');
    assert.equal(s.root.children.length, 0);
    assert.equal(s.frames.size, 0);
    assert.equal(s.page.style.visibility, '');
  } finally { controller.abort(); s.restore(); }
});

test('backgrounding a transition releases its snapshot and pending frame immediately', async () => {
  const s = scene();
  const controller = new AbortController();
  try {
    const finished = settleTiles(s.root, s.page, { opening: true, signal: controller.signal });
    s.advance(100);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await finished;
    assert.equal(s.root.children.length, 0);
    assert.equal(s.frames.size, 0);
    assert.equal(s.page.style.visibility, '');
    assert.equal(s.page.style.opacity, '');
  } finally { controller.abort(); s.restore(); }
});

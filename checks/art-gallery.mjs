import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { mountArtGallery } from '../src/scripts/art-gallery.js';

const html = await readFile(new URL('../dist/art/index.html', import.meta.url), 'utf8');

// Mount the real controller on the built native page. DOM events and history
// are real; geometry, pointer capture, and time are supplied without rendering.
async function scene(address = '/art/#artwork=03') {
  const window = new Window({ url: `https://portfolio.example${address}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  const { document } = window;
  document.write(html);
  window.history.replaceState({ retained: 'native Art' }, '', address);
  window.matchMedia = () => Object.assign(new window.EventTarget(), { matches: true });
  window.ontouchstart = null;
  let clock = 1000;
  Object.defineProperty(window.performance, 'now', { configurable: true, value: () => clock });
  const frames = new Map();
  let nextFrame = 0;
  window.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const root = document.querySelector('[data-art-root]');
  assert.ok(root, 'the built Art page provides the native gallery root');
  const stage = root.querySelector('[data-art-stage]');
  Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 390 });
  const captures = new Set();
  stage.setPointerCapture = id => captures.add(id);
  stage.hasPointerCapture = id => captures.has(id);
  stage.releasePointerCapture = id => captures.delete(id);
  let scrolledTarget = null;
  stage.scrollIntoView = () => { scrolledTarget = stage; };
  const globals = { window, document, AbortController: window.AbortController,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key,
    { configurable: true, writable: true, value });
  let cleanup;
  const flush = async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      const callbacks = [...frames.values()]; frames.clear();
      for (const callback of callbacks) callback(clock);
    }
  };
  const find = selector => { const node = root.querySelector(selector); assert.ok(node, `Missing ${selector}`); return node; };
  const click = node => {
    if (typeof node === 'string') node = find(node);
    const event = new window.MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
    node.dispatchEvent(event);
    return event;
  };
  const pointer = (type, x, y = 150, pointerType = 'mouse') => {
    const event = new window.PointerEvent(type, { pointerId: 7, pointerType, isPrimary: true,
      button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
    stage.dispatchEvent(event);
    return event;
  };
  const touch = (type, x, y = 150, target = stage) => {
    const point = { identifier: 3, clientX: x, clientY: y };
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      touches: type === 'touchend' || type === 'touchcancel' ? [] : [point], changedTouches: [point]
    });
    target.dispatchEvent(event);
    return event;
  };
  const assertArtwork = index => {
    assert.equal(root.dataset.artView, 'gallery');
    assert.equal(Number(root.dataset.artIndex), index);
    const items = [...root.querySelectorAll('[data-art-item]')];
    assert.equal(items.length, 5);
    assert.deepEqual(items.map(item => item.hidden), items.map((_, i) => i !== index));
    const current = [...root.querySelectorAll('[data-art-select][aria-current="true"]')];
    assert.equal(current.length, 1);
    assert.equal(Number(current[0].dataset.artSelect), index);
    const chapters = [...root.querySelectorAll('[data-art-details] .case-study-section')];
    assert.equal(chapters.length, 5);
    assert.deepEqual(chapters.map(chapter => chapter.hidden), chapters.map((_, i) => i !== index));
    assert.equal(find('[data-art-count]').textContent.replace(/\s/g, ''), `0${index + 1}/05`);
    assert.equal(find('[data-art-puzzle]').hidden, true);
  };
  const close = async () => {
    cleanup?.();
    await window.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
  try { cleanup = mountArtGallery(root); await flush(); }
  catch (error) { await close(); throw error; }
  return { window, document, root, stage, find, click, pointer, touch, flush, assertArtwork, close,
    get address() { return window.location.pathname + window.location.hash; },
    get scrolledTarget() { return scrolledTarget; },
    advance(milliseconds = 400) { clock += milliseconds; },
    async history(direction) { window.history[direction](); await flush(); },
    async hash(value) { window.location.hash = value; await flush(); }
  };
}

test('native Art direct entry, Back/Forward, hash changes, and skip preserve the selected artwork', async () => {
  const s = await scene();
  try {
    s.assertArtwork(2);
    const directEntries = s.window.history.length;
    s.click('[data-art-select="4"]');
    s.assertArtwork(4);
    assert.equal(s.address, '/art/#artwork=05');
    assert.equal(s.window.history.length, directEntries + 1);
    await s.history('back'); s.assertArtwork(2);
    assert.equal(s.address, '/art/#artwork=03');
    await s.history('forward'); s.assertArtwork(4);
    assert.equal(s.address, '/art/#artwork=05');
    await s.hash('#artwork=02'); s.assertArtwork(1);
    const entries = s.window.history.length;
    const state = structuredClone(s.window.history.state);
    const skip = s.document.querySelector('.serif-skip-link');
    assert.equal(s.click(skip).defaultPrevented, true);
    await s.flush();
    s.assertArtwork(1);
    assert.equal(s.address, '/art/#artwork=02');
    assert.equal(s.window.history.length, entries);
    assert.deepEqual(s.window.history.state, state);
    assert.equal(s.document.activeElement, s.stage);
    assert.equal(s.scrolledTarget, s.stage);
    await s.history('back'); s.assertArtwork(4);
    await s.history('forward'); s.assertArtwork(1);
    assert.equal(s.window.history.length, entries);
  } finally { await s.close(); }
});

test('native Art touch swipes select horizontally while reading scroll and taps remain available', async () => {
  const s = await scene();
  try {
    const entries = s.window.history.length;
    s.touch('touchstart', 250);
    assert.equal(s.touch('touchmove', 150, 152).defaultPrevented, true, 'horizontal movement reserves the swipe');
    s.touch('touchend', 150, 152);
    s.assertArtwork(3);
    assert.equal(s.address, '/art/#artwork=04');
    assert.equal(s.window.history.length, entries + 1);
    // A browser may also emit pointer events for the same native finger.
    s.pointer('pointerdown', 250, 150, 'touch');
    s.pointer('pointermove', 150, 152, 'touch');
    s.pointer('pointerup', 150, 152, 'touch');
    s.assertArtwork(3);
    assert.equal(s.window.history.length, entries + 1, 'one finger selects only once');
    assert.equal(s.click('[data-art-item="3"] [data-image-open]').defaultPrevented, true, 'a swipe does not accidentally enlarge its release target');
    assert.equal(s.find('[data-image-viewer]').open, false);
    s.advance();
    s.touch('touchstart', 250);
    assert.equal(s.touch('touchmove', 248, 240).defaultPrevented, false);
    assert.equal(s.touch('touchmove', 100, 245).defaultPrevented, false, 'vertical reading keeps ownership after sideways movement');
    s.touch('touchend', 100, 245);
    s.assertArtwork(3);
    const opener = s.find('[data-art-item="3"] [data-image-open]');
    assert.equal(s.touch('touchstart', 200, 150, opener).defaultPrevented, false);
    assert.equal(s.touch('touchmove', 198, 151, opener).defaultPrevented, false);
    assert.equal(s.touch('touchend', 198, 151, opener).defaultPrevented, false);
    s.assertArtwork(3);
    s.click(opener);
    assert.equal(s.find('[data-image-viewer]').open, true, 'an ordinary image tap retains enlargement');
    assert.equal(s.window.history.length, entries + 1);
  } finally { await s.close(); }
});

test('native Art pointer swipes select, and cancelled pointer/touch gestures never select', async () => {
  const s = await scene();
  try {
    s.pointer('pointerdown', 250);
    assert.equal(s.pointer('pointermove', 150, 152).defaultPrevented, true);
    assert.equal(s.stage.hasPointerCapture(7), true);
    s.pointer('pointerup', 150, 152);
    s.assertArtwork(3);
    assert.equal(s.stage.hasPointerCapture(7), false);
    const entries = s.window.history.length;
    for (const cancellation of ['pointercancel', 'lostpointercapture']) {
      s.pointer('pointerdown', 250);
      s.pointer('pointermove', 100, 151);
      s.pointer(cancellation, 100, 151);
      s.pointer('pointerup', 100, 151);
      s.assertArtwork(3);
      assert.equal(s.stage.hasPointerCapture(7), false);
      assert.equal(s.window.history.length, entries);
    }
    s.touch('touchstart', 250);
    s.touch('touchmove', 100, 151);
    s.touch('touchcancel', 100, 151);
    s.touch('touchend', 100, 151);
    s.assertArtwork(3);
    assert.equal(s.window.history.length, entries);
    s.pointer('pointerdown', 100);
    s.pointer('pointermove', 250, 152);
    s.pointer('pointerup', 250, 152);
    s.assertArtwork(2);
    assert.equal(s.address, '/art/#artwork=03', 'a cancelled gesture does not block the next valid swipe');
  } finally { await s.close(); }
});

test('native Art keyboard and swipe selection stop at five artworks without entering the puzzle', async () => {
  const s = await scene();
  try {
    const key = value => s.stage.dispatchEvent(new s.window.KeyboardEvent('keydown',
      { key: value, bubbles: true, cancelable: true }));
    key('End'); s.assertArtwork(4);
    assert.equal(s.address, '/art/#artwork=05');
    let entries = s.window.history.length;
    key('End'); key('ArrowRight');
    s.pointer('pointerdown', 250); s.pointer('pointermove', 100); s.pointer('pointerup', 100);
    s.assertArtwork(4);
    assert.equal(s.window.history.length, entries);
    assert.ok([...s.root.querySelectorAll('[data-art-step="1"]')].every(button => button.disabled));
    key('Home'); s.assertArtwork(0);
    entries = s.window.history.length;
    key('Home'); key('ArrowLeft');
    s.touch('touchstart', 100); s.touch('touchmove', 250); s.touch('touchend', 250);
    s.assertArtwork(0);
    assert.equal(s.address, '/art/#artwork=01');
    assert.equal(s.window.history.length, entries);
    assert.ok([...s.root.querySelectorAll('[data-art-step="-1"]')].every(button => button.disabled));
  } finally { await s.close(); }
});

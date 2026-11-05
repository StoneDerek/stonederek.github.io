import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { mountArtGallery } from '../src/scripts/art-gallery.js';

const html = await readFile(new URL('../dist/art/index.html', import.meta.url), 'utf8');

// Exercise the real built gallery and controller. Geometry, pointer capture and
// animation time are supplied; transform/rail movement, events and history are
// observed from the DOM. These checks do not establish browser rendering.
async function scene(address = '/art/#artwork=03', { reduced = true } = {}) {
  const window = new Window({ url: `https://portfolio.example${address}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  const { document } = window;
  document.write(html);
  window.history.replaceState({ retained: 'native Art' }, '', address);
  window.matchMedia = query => Object.assign(new window.EventTarget(), { matches: reduced && query.includes('reduced-motion') });
  window.ontouchstart = null;
  let clock = 1000;
  Object.defineProperty(window.performance, 'now', { configurable: true, value: () => clock });
  const frames = new Map(), timers = new Map();
  let nextFrame = 0, nextTimer = 0;
  window.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.setTimeout = (callback, delay = 0, ...args) => {
    const id = ++nextTimer; timers.set(id, { at: clock + delay, callback, args }); return id;
  };
  window.clearTimeout = id => timers.delete(id);
  const root = document.querySelector('[data-art-root]');
  assert.ok(root, 'the built Art page provides the gallery root');
  const stage = root.querySelector('[data-art-stage]');
  const track = root.querySelector('[data-art-track]');
  const rail = root.querySelector('[data-art-rail]');
  assert.ok(track && rail, 'the artwork and thumbnails retain continuous tracks');
  const stageWidth = 390, slideWidth = 273, thumbWidth = 88, thumbHeight = 58, stride = 88;
  const translation = () => {
    const match = track.style.transform.match(/translate(?:3d|X)\(\s*([-+e.\d]+)px/);
    assert.ok(match, `A pixel transform positions the actual gallery track: ${track.style.transform}`);
    return Number(match[1]);
  };
  const captures = new WeakMap();
  window.HTMLElement.prototype.setPointerCapture = function(id) { captures.set(this, id); };
  window.HTMLElement.prototype.hasPointerCapture = function(id) { return captures.get(this) === id; };
  window.HTMLElement.prototype.releasePointerCapture = function() { captures.delete(this); };
  window.HTMLElement.prototype.getBoundingClientRect = function() {
    const thumb = this.hasAttribute('data-art-select');
    const width = thumb ? thumbWidth : this.hasAttribute('data-art-item') ? slideWidth : stageWidth;
    const left = thumb ? (stageWidth - thumbWidth) / 2 + Number(this.dataset.artSelect) * stride - rail.scrollLeft : 0;
    const top = thumb ? 3 : 0, height = thumb ? thumbHeight : 320;
    return { x: left, y: top, left, top, right: left + width, bottom: top + height, width, height };
  };
  Object.defineProperties(window.HTMLElement.prototype, {
    clientWidth: { configurable: true, get() { return this.hasAttribute('data-art-item') ? slideWidth : stageWidth; } },
    clientHeight: { configurable: true, get() { return this === rail ? 64 : 320; } },
    offsetWidth: { configurable: true, get() { return this.hasAttribute('data-art-select') ? thumbWidth : this.hasAttribute('data-art-item') ? slideWidth : stageWidth; } },
    offsetHeight: { configurable: true, get() { return this.hasAttribute('data-art-select') ? thumbHeight : 320; } },
    offsetLeft: { configurable: true, get() { return this.hasAttribute('data-art-select') ? Number(this.dataset.artSelect) * stride : 0; } }
  });
  const originalStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = node => new Proxy(originalStyle(node), { get(target, key) {
    if (key === 'width' && node.hasAttribute('data-art-select')) return `${thumbWidth}px`;
    if (key === 'columnGap') return '0px';
    return Reflect.get(target, key);
  } });
  let scrolledTarget = null;
  stage.scrollIntoView = () => { scrolledTarget = stage; };
  const globals = { window, document, Element: window.Element, AbortController: window.AbortController,
    getComputedStyle: window.getComputedStyle,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key,
    { configurable: true, writable: true, value });
  let cleanup;
  const runTimers = () => {
    for (let round = 0; round < 32; round++) {
      const due = [...timers].filter(([, timer]) => timer.at <= clock);
      if (!due.length) return;
      for (const [id, timer] of due) { timers.delete(id); timer.callback(...timer.args); }
    }
    throw new Error('The fixture encountered an unbounded immediate timer');
  };
  const frame = async (milliseconds = 16) => {
    clock += milliseconds;
    runTimers();
    const callbacks = [...frames.values()]; frames.clear();
    for (const callback of callbacks) callback(clock);
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const flush = async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
    await frame(0);
  };
  const settle = async () => {
    await flush();
    for (let i = 0; i < 400 && (frames.size || timers.size); i++) await frame();
    assert.equal(frames.size + timers.size, 0, 'gallery motion and wheel input settle without a continuing frame loop');
  };
  const find = selector => { const node = root.querySelector(selector); assert.ok(node, `Missing ${selector}`); return node; };
  const click = node => {
    if (typeof node === 'string') node = find(node);
    const event = new window.MouseEvent('click', { button: 0, detail: 1, bubbles: true, cancelable: true });
    node.dispatchEvent(event); return event;
  };
  const pointer = (type, x, y = 150, surface = stage, pointerType = 'mouse') => {
    const event = new window.PointerEvent(type, { pointerId: 7, pointerType, isPrimary: true,
      button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
    surface.dispatchEvent(event); return event;
  };
  const touch = (type, x, y = 150, target = stage) => {
    const point = { identifier: 3, clientX: x, clientY: y };
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { touches: type === 'touchend' || type === 'touchcancel' ? [] : [point], changedTouches: [point] });
    target.dispatchEvent(event); return event;
  };
  const key = value => stage.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const assertArtwork = index => {
    assert.equal(root.dataset.artView, 'gallery');
    assert.equal(root.dataset.artSettled, 'true');
    assert.equal(Number(root.dataset.artIndex), index);
    const items = [...root.querySelectorAll('[data-art-item]')];
    assert.equal(items.length, 5);
    assert.ok(items.every(item => !item.hidden), 'neighboring figures stay in the continuous track');
    assert.deepEqual(items.map(item => item.getAttribute('aria-hidden')), items.map((_, i) => String(i !== index)));
    const current = [...root.querySelectorAll('[data-art-select][aria-current="true"]')];
    assert.equal(current.length, 1);
    assert.equal(Number(current[0].dataset.artSelect), index);
    assert.equal(find('[data-art-title]').textContent, `Untitled #${index + 1}`);
    assert.ok(Math.abs(rail.scrollLeft - index * stride) < .5, 'the selected thumbnail is centered after settling');
    const chapters = [...root.querySelectorAll('[data-art-details] .case-study-section')];
    assert.equal(chapters.length, 5);
    assert.deepEqual(chapters.map(chapter => chapter.hidden), chapters.map((_, i) => i !== index));
    assert.deepEqual(chapters.map(chapter => chapter.inert), chapters.map((_, i) => i !== index));
    assert.deepEqual(chapters.map(chapter => chapter.getAttribute('aria-hidden')), chapters.map((_, i) => String(i !== index)));
    assert.ok([...root.querySelectorAll('[data-art-details] .case-study-section h2')].every(heading => heading.hidden), 'original prose does not gain a visible number heading');
    assert.equal(root.querySelector('.art-caption, [data-art-step], [data-art-count]'), null);
    assert.ok([...root.querySelectorAll('[data-art-select]')].every(button => !button.textContent.trim()));
    assert.equal(find('[data-art-puzzle]').hidden, true);
  };
  const close = async () => {
    cleanup?.(); frames.clear(); timers.clear();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    await window.happyDOM.close();
  };
  try { cleanup = mountArtGallery(root); await settle(); }
  catch (error) { await close(); throw error; }
  return { window, document, root, stage, rail, track, find, click, pointer, touch, key, frame, flush, settle, translation, assertArtwork, close,
    get address() { return window.location.pathname + window.location.hash; },
    get scrolledTarget() { return scrolledTarget; },
    advance(milliseconds = 400) { clock += milliseconds; },
    async history(direction) { window.history[direction](); await settle(); },
    async hash(value) { window.location.hash = value; await settle(); }
  };
}

test('native Art direct entry, Back/Forward and skip retain the selected artwork and original notes', async () => {
  const s = await scene();
  try {
    s.assertArtwork(2);
    const entries = s.window.history.length;
    s.click('[data-art-select="4"]'); await s.settle(); s.assertArtwork(4);
    assert.equal(s.address, '/art/#artwork=05');
    assert.equal(s.window.history.length, entries + 1);
    await s.history('back'); s.assertArtwork(2);
    await s.history('forward'); s.assertArtwork(4);
    await s.hash('#artwork=02'); s.assertArtwork(1);
    const state = structuredClone(s.window.history.state), address = s.address;
    const skip = s.document.querySelector('.serif-skip-link');
    assert.equal(s.click(skip).defaultPrevented, true);
    await s.settle(); s.assertArtwork(1);
    assert.equal(s.address, address);
    assert.deepEqual(s.window.history.state, state);
    assert.equal(s.document.activeElement, s.stage);
    assert.equal(s.scrolledTarget, s.stage);
  } finally { await s.close(); }
});

test('a held Art drag visibly follows fractional movement, then springs to its release destination', async () => {
  const s = await scene('/art/#artwork=03', { reduced: false });
  try {
    const start = s.translation(), entries = s.window.history.length;
    const items = [...s.root.querySelectorAll('[data-art-item]')];
    assert.equal(Number(items[2].style.getPropertyValue('--art-image-scale')), 1);
    assert.ok(Number(items[1].style.getPropertyValue('--art-image-scale')) < 1, 'neighbor photographs start slightly smaller than the selected photo');
    for (const item of items) {
      const photo = item.querySelector('[data-image-open] img');
      const width = parseFloat(photo.style.width), height = parseFloat(photo.style.height);
      assert.ok(width > 0 && width <= 273 && height > 0 && height <= 320, 'the complete photo fits within its bounded slide');
      assert.ok(Math.abs(width / height - Number(photo.getAttribute('width')) / Number(photo.getAttribute('height'))) < .001);
    }
    const outline = s.find('[data-art-selection-frame]');
    const selectedThumb = s.find('[data-art-select="2"]').getBoundingClientRect();
    assert.equal(parseFloat(outline.style.left), selectedThumb.left - 2);
    assert.equal(parseFloat(outline.style.top), selectedThumb.top - 2);
    assert.equal(parseFloat(outline.style.width), selectedThumb.width + 4);
    assert.equal(parseFloat(outline.style.height), selectedThumb.height + 4);
    s.pointer('pointerdown', 250);
    s.advance(40); s.pointer('pointermove', 209); await s.frame();
    const first = s.translation();
    assert.ok(first < start && first > start - 273, 'a partial drag moves the track by part of one artwork');
    s.advance(40); s.pointer('pointermove', 168); await s.frame();
    const held = s.translation();
    assert.ok(parseFloat(s.track.style.getPropertyValue('--art-gallery-radius')) > 0, 'the original gallery lift rounds photo corners while dragging');
    assert.ok(held < first && held > start - 273, 'the next pointer sample advances the actual track continuously');
    assert.ok(s.rail.scrollLeft > 2 * 88 && s.rail.scrollLeft < 3 * 88, 'the thumbnail rail follows the same intermediate selection');
    assert.equal(s.root.dataset.artSettled, 'false');
    assert.equal(s.window.history.length, entries, 'held motion does not add history destinations');
    s.pointer('pointerup', 168);
    assert.equal(s.stage.hasPointerCapture(7), false);
    await s.frame();
    assert.ok(s.translation() < held && s.translation() > start - 273, 'release advances through an intermediate spring position');
    assert.equal(s.window.history.length, entries);
    await s.settle(); s.assertArtwork(3);
    assert.equal(parseFloat(s.track.style.getPropertyValue('--art-gallery-radius')), 0, 'corner rounding returns to rest after settling');
    assert.equal(Number(items[3].style.getPropertyValue('--art-image-scale')), 1);
    const settledThumb = s.find('[data-art-select="3"]').getBoundingClientRect();
    assert.equal(parseFloat(outline.style.left), settledThumb.left - 2, 'the accent frame remains centered on the settled thumbnail');
    assert.equal(s.window.history.length, entries + 1);
    assert.equal(s.address, '/art/#artwork=04');
  } finally { await s.close(); }
});

test('thumbnail click, drag and wheel keep the rail coupled to the gallery and commit once per gesture', async () => {
  const s = await scene('/art/#artwork=02', { reduced: false });
  try {
    let entries = s.window.history.length;
    const start = s.translation();
    s.click('[data-art-select="3"]'); await s.frame();
    assert.ok(s.translation() < start && s.rail.scrollLeft > 88 && s.rail.scrollLeft < 3 * 88, 'thumbnail selection animates both tracks');
    assert.equal(s.window.history.length, entries);
    await s.settle(); s.assertArtwork(3);
    assert.equal(s.window.history.length, ++entries);
    s.pointer('pointerdown', 200, 150, s.rail);
    s.advance(80); s.pointer('pointermove', 245, 150, s.rail); await s.frame();
    assert.ok(s.rail.scrollLeft < 3 * 88 && s.rail.scrollLeft > 2 * 88, 'dragging the rail moves by thumbnail units');
    s.advance(140); s.pointer('pointerup', 245, 150, s.rail);
    await s.settle(); s.assertArtwork(2);
    assert.equal(s.window.history.length, ++entries);
    s.advance();
    const wheelStart = s.translation();
    for (let i = 0; i < 3; i++) {
      const event = new s.window.WheelEvent('wheel', { deltaY: 22, bubbles: true, cancelable: true });
      s.rail.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
      await s.frame();
    }
    assert.ok(s.translation() < wheelStart);
    assert.equal(s.window.history.length, entries, 'wheel samples share a single unfinished gesture');
    await s.settle(); s.assertArtwork(3);
    assert.equal(s.window.history.length, entries + 1);
  } finally { await s.close(); }
});

test('recent flick momentum advances a short drag while a paused or cancelled drag returns to its origin', async () => {
  const s = await scene('/art/#artwork=03', { reduced: false });
  try {
    const entries = s.window.history.length;
    s.pointer('pointerdown', 200);
    s.advance(16); s.pointer('pointermove', 180); await s.frame();
    s.advance(150); s.pointer('pointerup', 180); await s.settle();
    s.assertArtwork(2); assert.equal(s.window.history.length, entries);
    s.advance(); s.pointer('pointerdown', 200);
    s.advance(16); s.pointer('pointermove', 118); await s.frame();
    assert.ok(s.translation() < -2 * 273 + (390 - 273) / 2);
    s.pointer('pointercancel', 118); await s.settle();
    s.assertArtwork(2); assert.equal(s.window.history.length, entries);
    s.advance(); s.pointer('pointerdown', 200);
    s.advance(16); s.pointer('pointermove', 180); await s.frame();
    s.pointer('pointerup', 180); await s.settle();
    s.assertArtwork(3); assert.equal(s.window.history.length, entries + 1);
  } finally { await s.close(); }
});

test('native Art touch preserves reading scroll and image taps and ignores duplicate pointer input', async () => {
  const s = await scene();
  try {
    const entries = s.window.history.length;
    s.touch('touchstart', 250);
    assert.equal(s.touch('touchmove', 150, 152).defaultPrevented, true);
    await s.frame(); s.touch('touchend', 150, 152); await s.settle();
    s.assertArtwork(3); assert.equal(s.window.history.length, entries + 1);
    s.pointer('pointerdown', 250, 150, s.stage, 'touch');
    s.pointer('pointermove', 150, 152, s.stage, 'touch');
    s.pointer('pointerup', 150, 152, s.stage, 'touch'); await s.settle();
    s.assertArtwork(3); assert.equal(s.window.history.length, entries + 1);
    assert.equal(s.click('[data-art-item="3"] [data-image-open]').defaultPrevented, true);
    assert.equal(s.find('[data-image-viewer]').open, false);
    s.advance(); s.touch('touchstart', 250);
    assert.equal(s.touch('touchmove', 248, 240).defaultPrevented, false);
    assert.equal(s.touch('touchmove', 100, 245).defaultPrevented, false);
    s.touch('touchend', 100, 245); await s.settle(); s.assertArtwork(3);
    const opener = s.find('[data-art-item="3"] [data-image-open]');
    s.touch('touchstart', 200, 150, opener); s.touch('touchmove', 198, 151, opener); s.touch('touchend', 198, 151, opener);
    s.click(opener);
    assert.equal(s.find('[data-image-viewer]').open, true, 'an ordinary image tap retains enlargement');
    assert.equal(s.window.history.length, entries + 1);
  } finally { await s.close(); }
});

test('keyboard selection stops at the five artworks and never enters the hidden puzzle', async () => {
  const s = await scene();
  try {
    s.key('End'); await s.settle(); s.assertArtwork(4);
    let entries = s.window.history.length;
    s.key('End'); s.key('ArrowRight');
    s.pointer('pointerdown', 250); s.pointer('pointermove', 100); await s.frame(); s.pointer('pointerup', 100);
    await s.settle(); s.assertArtwork(4);
    assert.equal(s.window.history.length, entries);
    s.advance(); s.key('Home'); await s.settle(); s.assertArtwork(0);
    entries = s.window.history.length;
    s.key('Home'); s.key('ArrowLeft');
    s.touch('touchstart', 100); s.touch('touchmove', 250); await s.frame(); s.touch('touchend', 250);
    await s.settle(); s.assertArtwork(0);
    assert.equal(s.address, '/art/#artwork=01');
    assert.equal(s.window.history.length, entries);
  } finally { await s.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mountProjectCaption } from '../src/scripts/project-caption.js';

function scene({ hidden = true, reduced = false, endsAt = 0 } = {}) {
  const names = ['document', 'performance', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const frames = new Map(), classes = new Set(), measurements = [];
  let time = 0, sequence = 0;
  class Node {
    constructor() { this.style = {}; this.children = []; this.text = ''; }
    set textContent(text) { this.text = text; this.children = []; }
    get textContent() { return this.children.length ? this.children.map(child => child.textContent).join('') : this.text; }
    append(child) { this.children.push(child); }
    replaceChildren(fragment) { this.text = ''; this.children = [...fragment.children]; }
  }
  const text = new Node(), metrics = new Node(), word = new Node();
  text.textContent = metrics.textContent = 'Signal studies';
  const width = text => [...text].reduce((sum, letter) => sum + (letter === ' ' ? 4 : /[il.]/.test(letter) ? 3 : 7), 0);
  const doc = {
    createElement(tag) { return tag === 'canvas' ? { getContext: () => ({ measureText: text => ({ width: width(text) }) }) } : new Node(); },
    createDocumentFragment() { return new Node(); }
  };
  const caption = { hidden, ownerDocument: doc, querySelector: selector => ({
    '.caption-word': word, '[data-title]': text, '[data-title-metrics]': metrics
  })[selector] };
  metrics.getBoundingClientRect = () => {
    measurements.push({ hidden: caption.hidden, text: metrics.textContent });
    return { width: caption.hidden ? 0 : width(metrics.textContent) };
  };
  word.getBoundingClientRect = () => ({ width: caption.hidden ? 0 : word.style.width ? parseFloat(word.style.width) : width(metrics.textContent) });
  const root = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
  Object.assign(globalThis, {
    document: doc, performance: { now: () => time },
    getComputedStyle: () => ({ fontWeight: '600', fontSize: '14px', fontFamily: 'Arial' }),
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  const preference = { matches: reduced };
  const motion = mountProjectCaption(caption, root, preference, { endsAt: () => endsAt });
  return { motion, caption, text, metrics, word, frames, classes, measurements, preference, width,
    advance(next) { time = next; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    restore() {
      motion.destroy();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  };
}

test('entering Projects reveals the caption before measurement and draws intermediate glyphs', () => {
  const s = scene();
  try {
    s.motion.set('Signal studies');
    assert.equal(s.caption.hidden, false);
    assert.ok(s.measurements.length > 0);
    assert.ok(s.measurements.every(read => !read.hidden));
    assert.equal(s.text.textContent, '', 'a hidden previous title must not flash on entry');
    assert.ok(Math.abs(parseFloat(s.word.style.width) - s.width('Signal studies')) < .001);
    s.advance(100);
    assert.ok(s.text.textContent.trim().length > 0, 'the title must be drawn before the animation completes');
    assert.notEqual(s.text.textContent, 'Signal studies');
    assert.ok(parseFloat(s.word.style.width) > 0);
    assert.ok(Math.abs(parseFloat(s.word.style.width) - s.width('Signal studies')) < .001,
      'entering glyphs need their readable width throughout the scramble');
    s.advance(360);
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.word.style.width, '');
    assert.equal(s.motion.animating, false);
    assert.equal(s.classes.has('is-scrambling'), false);
  } finally { s.restore(); }
});

test('reentering the same project after About starts another visible transition', () => {
  const s = scene({ hidden: false });
  try {
    s.motion.set('Signal studies', { immediate: true });
    s.motion.hide();
    assert.equal(s.caption.hidden, true);
    s.motion.set('Signal studies');
    assert.equal(s.text.textContent, '');
    s.advance(180);
    assert.ok(parseFloat(s.word.style.width) > 0);
    assert.equal(s.motion.animating, true);
    s.advance(360);
    assert.equal(s.text.textContent, 'Signal studies');
  } finally { s.restore(); }
});

test('project changes and rapid reversals continue from the glyphs and width on screen', () => {
  const s = scene({ hidden: false });
  try {
    s.motion.set('Soft machines');
    assert.equal(s.text.textContent, 'Signal studies');
    s.advance(120);
    const drawn = s.text.textContent, drawnWidth = parseFloat(s.word.style.width);
    s.motion.set('Signal studies', { direction: -1 });
    assert.equal(s.text.textContent, drawn);
    assert.ok(Math.abs(parseFloat(s.word.style.width) - drawnWidth) < .001);
    assert.equal(s.frames.size, 1);
    s.advance(480);
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.frames.size, 0);
  } finally { s.restore(); }
});

test('leaving a partially animated caption cancels it before another entry', () => {
  const s = scene();
  try {
    s.motion.set('Signal studies'); s.advance(100); s.motion.hide();
    assert.equal(s.caption.hidden, true);
    assert.equal(s.frames.size, 0);
    assert.equal(s.classes.has('is-scrambling'), false);
    s.motion.set('Afterimage', { direction: -1 });
    assert.equal(s.text.textContent, '');
    s.advance(280);
    assert.ok(parseFloat(s.word.style.width) > 0);
    s.advance(460);
    assert.equal(s.text.textContent, 'Afterimage');
  } finally { s.restore(); }
});

test('reduced motion and initial direct entry show the complete title immediately', () => {
  for (const options of [{ reduced: true }, {}]) {
    const s = scene(options);
    try {
      s.motion.set('Signal studies', { immediate: !options.reduced });
      assert.equal(s.caption.hidden, false);
      assert.equal(s.text.textContent, 'Signal studies');
      assert.equal(s.frames.size, 0);
      assert.equal(s.measurements.length, 0);
    } finally { s.restore(); }
  }
});

test('an article can pause the drawn title and finish its return cover without a stale frame', () => {
  const s = scene({ hidden: false });
  try {
    s.motion.set('Soft machines'); s.advance(100);
    const drawn = s.text.textContent;
    s.motion.pause(); s.advance(220);
    assert.equal(s.text.textContent, drawn);
    assert.equal(s.frames.size, 0);
    s.motion.finish();
    assert.equal(s.text.textContent, 'Soft machines');
    assert.equal(s.word.style.width, '');
  } finally { s.restore(); }
});

test('settling timing, preference changes, and cleanup release pending frames', () => {
  const s = scene({ endsAt: 800 });
  try {
    s.motion.set('Signal studies'); s.advance(400);
    assert.equal(s.motion.animating, true);
    s.advance(420);
    assert.equal(s.motion.animating, false, 'caption timing must retain its existing 420ms cap');
    s.motion.set('Afterimage'); s.advance(500);
    s.preference.matches = true; s.motion.finish();
    assert.equal(s.text.textContent, 'Afterimage');
    assert.equal(s.frames.size, 0);
    s.preference.matches = false;
    s.motion.set('Field notes'); s.motion.destroy(); s.advance(900);
    s.motion.set('Night shift');
    assert.equal(s.text.textContent, 'Field notes');
    assert.equal(s.frames.size, 0);
    assert.equal(s.classes.has('is-scrambling'), false);
  } finally { s.restore(); }
});

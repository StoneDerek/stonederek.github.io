import test from 'node:test';
import assert from 'node:assert/strict';
import { mountProjectCaption } from '../src/scripts/project-caption.js';
import { galleryFrame, galleryCaptionFrame } from '../src/scripts/section-state.js';
import { createMotionSpring } from '../src/scripts/motion-spring.js';

function scene({ hidden = true, reduced = false, endsAt = 0 } = {}) {
  const names = ['document', 'performance', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const frames = new Map(), classes = new Set(), measurements = [];
  let time = 0, sequence = 0;
  class Node {
    constructor() { this.style = {}; this.children = []; this.text = ''; this.dataset = {}; this.attributes = new Map(); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    set textContent(text) { this.text = text; this.children = []; }
    get textContent() { return this.children.length ? this.children.map(child => child.textContent).join('') : this.text; }
    append(child) { this.children.push(child); }
    replaceChildren(fragment) { this.text = ''; this.children = [...fragment.children]; }
  }
  const text = new Node(), metrics = new Node(), word = new Node(), button = new Node(), heading = new Node();
  text.textContent = metrics.textContent = 'Signal studies';
  const width = text => [...text].reduce((sum, letter) => sum + (letter === ' ' ? 4 : /[il.]/.test(letter) ? 3 : 7), 0);
  const doc = {
    createElement(tag) { return tag === 'canvas' ? { getContext: () => ({ measureText: text => ({ width: width(text) }) }) } : new Node(); },
    createDocumentFragment() { return new Node(); }
  };
  const caption = Object.assign(new Node(), { hidden, ownerDocument: doc, querySelector: selector => ({
    '.caption-word': word, '[data-title]': text, '[data-title-metrics]': metrics, '.caption-link': button, 'h1': heading
  })[selector] });
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
  return { motion, caption, text, metrics, word, button, heading, frames, classes, measurements, preference, width,
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
    assert.equal(parseFloat(s.word.style.width), 0);
    s.advance(100);
    assert.ok(s.text.textContent.trim().length > 0, 'the title must be drawn before the animation completes');
    assert.notEqual(s.text.textContent, 'Signal studies');
    assert.ok(parseFloat(s.word.style.width) > 0);
    assert.ok(parseFloat(s.word.style.width) < s.width('Signal studies'));
    assert.ok(s.text.textContent.length < 'Signal studies'.length, 'entry must add characters throughout the scramble');
    s.advance(360);
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.word.style.width, '');
    assert.equal(s.motion.animating, false);
    assert.equal(s.classes.has('is-scrambling'), false);
  } finally { s.restore(); }
});

const view = (position, destination = null) => galleryCaptionFrame(galleryFrame(position, 7), 2, destination);

test('About entry starts with navigation and resolves in 180ms without waiting for selection', () => {
  const s = scene();
  try {
    s.motion.present(view(1), { title: 'Signal studies', immediate: true });
    s.motion.present(view(1, 2), { title: 'Signal studies' });
    assert.equal(s.caption.hidden, true);
    const counts = [];
    for (const time of [16, 30, 60, 90, 120, 180]) {
      s.advance(time);
      counts.push(s.text.textContent.length);
    }
    assert.ok(counts[0] > 0, 'the first animation frame must show entering characters');
    assert.ok(new Set(counts).size >= 5);
    assert.ok(counts.every((count, i) => !i || count >= counts[i - 1]));
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.word.style.width, '');
    assert.equal(s.frames.size, 0);
    assert.equal(s.caption.inert, true, 'early drawing must not steal About interaction');
    s.motion.present(view(2), { title: 'Signal studies' });
    assert.equal(s.caption.inert, false);
  } finally { s.restore(); }
});

test('returning to About rewinds the same glyphs and continuous widths on the same 180ms clock', () => {
  const s = scene();
  try {
    const times = [30, 60, 90, 120, 150, 180];
    const drawings = new Map();
    s.motion.present(view(1), { title: 'Signal studies', immediate: true });
    s.motion.present(view(1, 2), { title: 'Signal studies' });
    for (const time of times) {
      s.advance(time);
      drawings.set(time, { text: s.text.textContent, width: parseFloat(s.word.style.width) });
    }
    s.motion.present(view(2, 1), { title: 'Signal studies' });
    for (const time of times.slice(0, -1)) {
      s.advance(180 + time);
      const forward = drawings.get(180 - time);
      assert.equal(s.text.textContent, forward.text);
      assert.ok(Math.abs(parseFloat(s.word.style.width) - forward.width) < .001);
    }
    s.advance(360);
    assert.equal(s.caption.hidden, true);
    assert.equal(s.text.textContent, '');
    assert.equal(s.classes.has('is-scrambling'), false);
  } finally { s.restore(); }
});

test('an interrupted About transition reverses from its visible glyphs without restarting a full duration', () => {
  const s = scene();
  try {
    s.motion.present(view(1), { title: 'Signal studies', immediate: true });
    s.motion.present(view(1, 2), { title: 'Signal studies' });
    s.advance(60);
    const first = { text: s.text.textContent, width: s.word.style.width };
    s.motion.present(view(1.4, 1), { title: 'Signal studies' });
    assert.deepEqual({ text: s.text.textContent, width: s.word.style.width }, first);
    s.advance(90);
    assert.ok(parseFloat(s.word.style.width) < parseFloat(first.width));
    s.advance(120);
    assert.equal(s.caption.hidden, true, 'a one-third entrance needs only one-third of the clock to reverse');
    assert.equal(s.frames.size, 0);
    s.motion.present(view(1.2, 2), { title: 'Signal studies' });
    s.advance(300);
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.classes.has('is-scrambling'), false);
  } finally { s.restore(); }
});

test('holding a drag still after selection lets the full entrance and exit finish in 180ms', () => {
  const s = scene();
  try {
    s.motion.present(view(1), { title: 'Signal studies', immediate: true });
    s.motion.present(view(1.51), { title: 'Signal studies' });
    s.advance(90);
    assert.ok(s.text.textContent.length > 0 && s.text.textContent.length < 14);
    s.advance(179);
    assert.equal(s.motion.animating, true);
    s.advance(180);
    assert.equal(s.text.textContent, 'Signal studies');
    assert.equal(s.motion.animating, false);
    s.motion.present(view(1.49), { title: 'Signal studies' });
    s.advance(359);
    assert.equal(s.motion.animating, true);
    s.advance(360);
    assert.equal(s.caption.hidden, true);
    assert.equal(s.motion.animating, false);
  } finally { s.restore(); }
});

test('slow, fast and stationary drags draw identical glyphs and widths at equal elapsed times', () => {
  const paths = [[1.51, 1.51, 1.51, 1.51], [1.51, 1.52, 1.54, 1.56], [1.51, 1.75, 1.9, 2]];
  let expected;
  for (const positions of paths) {
    const s = scene();
    try {
      s.motion.present(view(1), { title: 'Signal studies', immediate: true });
      s.motion.present(view(positions[0]), { title: 'Signal studies' });
      const drawings = positions.map((position, index) => {
        s.advance(index * 60);
        s.motion.present(view(position), { title: 'Signal studies' });
        return { text: s.text.textContent, width: s.word.style.width };
      });
      expected ??= drawings;
      assert.deepEqual(drawings, expected);
      assert.equal(s.text.textContent, 'Signal studies');
      assert.equal(s.frames.size, 0);
    } finally { s.restore(); }
  }
});

test('a caption-held drag survives crossing into Home/About and is hidden after release', () => {
  const s = scene();
  try {
    s.motion.present(view(2), { title: 'Signal studies', immediate: true });
    s.motion.present(view(.9), { title: 'Signal studies', holdPointer: true });
    assert.equal(s.caption.hidden, false);
    assert.equal(s.caption.inert, false);
    assert.equal(s.button.inert, false);
    assert.equal(s.caption.getAttribute('aria-hidden'), 'true');
    s.advance(360);
    assert.equal(s.caption.hidden, false, 'the held drag target must survive even after its text has exited');
    assert.equal(s.button.style.opacity, '0');
    s.motion.present(view(.9), { title: 'Signal studies' });
    assert.equal(s.caption.hidden, true);
    assert.equal(s.caption.inert, true);
    assert.equal(s.frames.size, 0);
  } finally { s.restore(); }
});

test('direct Links entry and return use the resolved last-project caption without a new scramble', () => {
  const s = scene();
  try {
    s.motion.present(view(7), { title: 'Night shift', immediate: true });
    assert.equal(s.caption.hidden, true);
    assert.equal(s.text.textContent, 'Night shift');
    s.motion.present(view(6.4), { title: 'Night shift' });
    assert.equal(s.caption.hidden, false);
    assert.equal(s.text.textContent, 'Night shift');
    assert.equal(s.frames.size, 0);
  } finally { s.restore(); }
});

test('presentation preserves immediate direct entry and reduced-motion navigation', () => {
  for (const reduced of [false, true]) {
    const s = scene({ reduced });
    try {
      s.motion.present(view(2), { title: 'Signal studies', immediate: true });
      assert.equal(s.text.textContent, 'Signal studies');
      if (reduced) {
        s.motion.present(view(1.75), { title: 'Signal studies' });
        assert.equal(s.text.textContent, 'Signal studies');
        s.motion.present(view(2.6), { title: 'Soft machines' });
        assert.equal(s.text.textContent, 'Soft machines');
        assert.equal(s.button.dataset.project, '3');
      }
      assert.equal(s.frames.size, 0);
    } finally { s.restore(); }
  }
});

test('click-driven gallery motion draws multiple partial character counts before the full title', () => {
  for (const unit of [390, 1440]) {
    const s = scene();
    try {
      const spring = createMotionSpring({ from: 1, to: 2, unit });
      const counts = new Set();
      for (let elapsed = 0; elapsed <= spring.duration; elapsed += 1000 / 60) {
        s.advance(elapsed);
        const position = spring.sample(elapsed).position;
        s.motion.present(view(position, 2), { title: 'Signal studies' });
        counts.add(s.caption.hidden ? 0 : s.text.textContent.length);
      }
      s.advance(spring.duration + 420);
      s.motion.present(view(2), { title: 'Signal studies' });
      assert.ok(counts.has(0));
      assert.ok([...counts].filter(count => count > 0 && count < 14).length >= 3,
        'a click must include several visible partial titles, not only a blank and a completed title');
      assert.equal(s.text.textContent, 'Signal studies');
      assert.equal(s.frames.size, 0);
    } finally { s.restore(); }
  }
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

test('entry and ordinary project changes share the same default, minimum, and maximum scramble durations', () => {
  for (const [endsAt, duration] of [[0, 360], [100, 180], [800, 420]]) {
    for (const hidden of [true, false]) {
      const s = scene({ hidden, endsAt });
      try {
        s.motion.set(hidden ? 'Signal studies' : 'Soft machines');
        s.advance(duration - 1);
        assert.equal(s.motion.animating, true);
        s.advance(duration);
        assert.equal(s.motion.animating, false);
        assert.equal(s.text.textContent, hidden ? 'Signal studies' : 'Soft machines');
        assert.equal(s.frames.size, 0);
      } finally { s.restore(); }
    }
  }
});

test('preference changes and cleanup release pending frames', () => {
  const s = scene();
  try {
    s.motion.set('Afterimage'); s.advance(80);
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

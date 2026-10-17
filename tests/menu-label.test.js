import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMenuLabel } from '../src/scripts/menu-label.js';

const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function scene({ reduced = false, supported = true } = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  const animations = [];
  const label = { textContent: 'Home:', style: { opacity: '', transform: '' },
    drawn: { opacity: '1', transform: 'none' } };
  if (supported) label.animate = (frames, options) => {
    let finish, reject;
    const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
    const animation = { frames, options, finished, finish, cancelled: false,
      cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    animations.push(animation);
    return animation;
  };
  globalThis.getComputedStyle = el => el.drawn;
  const preference = { matches: reduced };
  const motion = mountMenuLabel(label, preference);
  return { label, motion, animations, preference, restore() {
    motion.destroy();
    if (descriptor) Object.defineProperty(globalThis, 'getComputedStyle', descriptor);
    else delete globalThis.getComputedStyle;
  } };
}

test('section changes in either direction keep the old text until it exits and clean up the new label', async () => {
  const s = scene();
  try {
    for (const [previous, next] of [['Home:', 'About:'], ['About:', 'Home:']]) {
      const offset = s.animations.length;
      const pending = s.motion.set(next);
      assert.equal(s.label.textContent, previous);
      s.animations[offset].finish(); await tick();
      assert.equal(s.label.textContent, next);
      s.animations[offset + 1].finish(); await pending;
      assert.ok(s.animations.every(animation => animation.cancelled));
      assert.deepEqual(s.label.style, { opacity: '', transform: '' });
      await s.motion.set(next);
      assert.equal(s.animations.length, offset + 2, 'same-label requests must not restart motion');
    }
  } finally { s.restore(); }
});

test('a newer request during the outgoing phase prevents stale text from being inserted', async () => {
  const s = scene();
  try {
    const stale = s.motion.set('About:');
    const latest = s.motion.set('Projects:');
    await tick();
    assert.equal(s.label.textContent, 'Home:');
    assert.equal(s.animations[0].cancelled, true);
    s.animations[0].finish(); await tick();
    assert.equal(s.label.textContent, 'Home:');
    s.animations[1].finish(); await tick();
    assert.equal(s.label.textContent, 'Projects:');
    s.animations[2].finish(); await Promise.all([stale, latest]);
    assert.equal(s.label.textContent, 'Projects:');
  } finally { s.restore(); }
});

test('interrupting an incoming label continues upward from its drawn position', async () => {
  const s = scene();
  try {
    const stale = s.motion.set('About:');
    s.animations[0].finish(); await tick();
    s.label.drawn = { opacity: '.55', transform: 'matrix(1, 0, 0, 1, 0, 9)' };
    const latest = s.motion.set('Home:');
    assert.deepEqual(s.animations[2].frames[0], s.label.drawn);
    assert.equal(s.animations[2].frames[1].transform, 'translateY(-100%)');
    s.animations[1].finish(); await tick();
    assert.equal(s.label.textContent, 'About:');
    s.animations[2].finish(); await tick();
    assert.equal(s.label.textContent, 'Home:');
    s.animations[3].finish(); await Promise.all([stale, latest]);
    assert.ok(s.animations.every(animation => animation.cancelled));
  } finally { s.restore(); }
});

test('finishing after a reduced-motion change cancels effects and keeps the latest requested text', async () => {
  const s = scene();
  try {
    const pending = s.motion.set('About:');
    s.preference.matches = true;
    await s.motion.finish(); await pending;
    assert.equal(s.label.textContent, 'About:');
    assert.equal(s.animations.length, 1);
    assert.equal(s.animations[0].cancelled, true);
    await s.motion.set('Home:');
    assert.equal(s.label.textContent, 'Home:');
    assert.equal(s.animations.length, 1);
  } finally { s.restore(); }
});

test('labels update immediately when the animation API is unavailable', async () => {
  const s = scene({ supported: false });
  try {
    await s.motion.set('About:');
    assert.equal(s.label.textContent, 'About:');
    assert.deepEqual(s.label.style, { opacity: '', transform: '' });
  } finally { s.restore(); }
});

test('destroying a running transition prevents later callbacks or requests from writing labels', async () => {
  const s = scene();
  try {
    const pending = s.motion.set('About:');
    s.motion.destroy(); await pending;
    assert.equal(s.label.textContent, 'About:');
    assert.equal(s.animations[0].cancelled, true);
    s.animations[0].finish(); await s.motion.set('Home:');
    assert.equal(s.label.textContent, 'About:');
    assert.equal(s.animations.length, 1);
  } finally { s.restore(); }
});

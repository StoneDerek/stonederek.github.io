import test from 'node:test';
import assert from 'node:assert/strict';
import { mountTrophy } from '../src/scripts/trophy-ascii.js';

function renderer({ reduced = false } = {}) {
  const names = ['window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const callbacks = new Map(), samples = [], documentEvents = new EventTarget(), preference = new EventTarget();
  preference.matches = reduced;
  let time = 0, sequence = 0;
  const context = { setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, fillText() {},
    getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }) };
  const canvas = () => ({ clientWidth: 320, clientHeight: 220, getContext: () => context });
  Object.assign(globalThis, {
    window: { devicePixelRatio: 1, __PORTFOLIO_LASER_PROFILE__: true, matchMedia: () => preference },
    document: { hidden: false, createElement: canvas, addEventListener: (...args) => documentEvents.addEventListener(...args),
      dispatchEvent: event => documentEvents.dispatchEvent(event) },
    ResizeObserver: class { observe() {} disconnect() {} },
    performance: { now: () => time },
    requestAnimationFrame: callback => { callbacks.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => callbacks.delete(id)
  });
  documentEvents.addEventListener('portfolio:trophy-frame', event => samples.push({ time, ...event.detail }));
  const trophy = mountTrophy(canvas());
  return { trophy, samples, callbacks,
    advance(now) { time = now; const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(now)); },
    restore() { trophy.destroy(); for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    } }
  };
}

test('high-refresh screens keep the same 2.4-second spin with at most 60 draws per second', () => {
  for (const hz of [60, 120, 240]) {
    const r = renderer();
    try {
      r.trophy.start(); r.advance(0);
      for (let tick = 1; tick <= hz * 2.4 + 1; tick++) r.advance(tick * 1000 / hz);
      assert.ok(r.samples.length >= 144 && r.samples.length <= 146, `${hz}Hz: ${r.samples.length} draws`);
      assert.equal(r.samples[0].progress, 0);
      assert.equal(r.samples.at(-1).progress, 1);
      assert.ok(r.samples.at(-1).time >= 2400 && r.samples.at(-1).time < 2420);
      assert.equal(r.callbacks.size, 0, 'the settled trophy stays idle');
    } finally { r.restore(); }
  }
});

test('reduced motion draws a static trophy and stopping a spin cancels its pending frame', () => {
  const still = renderer({ reduced: true });
  try {
    still.trophy.start(); still.advance(0);
    assert.equal(still.samples.length, 1); assert.equal(still.samples[0].progress, 1); assert.equal(still.callbacks.size, 0);
  } finally { still.restore(); }
  const moving = renderer();
  try {
    moving.trophy.start(); moving.advance(0); moving.trophy.stop(); moving.advance(1000);
    assert.equal(moving.samples.length, 1); assert.equal(moving.callbacks.size, 0);
  } finally { moving.restore(); }
});

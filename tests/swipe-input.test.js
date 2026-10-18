import test from 'node:test';
import assert from 'node:assert/strict';
import { mountSwipeInput } from '../src/scripts/swipe-input.js';
import { settleProjectSwipe } from '../src/scripts/section-state.js';

function scene({ nativeTouch = true, accepted = true } = {}) {
  const surface = new EventTarget();
  const controller = new AbortController();
  const calls = [];
  const input = mountSwipeInput(surface, {
    nativeTouch, signal: controller.signal,
    start: event => { calls.push(['start', event]); return accepted; },
    move: event => calls.push(['move', event]),
    end: (event, cancelled) => calls.push(['end', event, cancelled])
  });
  const emit = (type, fields = {}, cancelable = true) => {
    const event = new Event(type, { cancelable });
    Object.assign(event, fields);
    surface.dispatchEvent(event);
    return event;
  };
  const point = (x, y = 100, identifier = 3) => ({ identifier, clientX: x, clientY: y });
  const begin = (x = 200, y = 100) => emit('touchstart', { touches: [point(x, y)] });
  const move = (x, y = 100, cancelable = true) => emit('touchmove', { touches: [point(x, y)] }, cancelable);
  const release = (x, y = 100) => emit('touchend', { touches: [], changedTouches: [point(x, y)] });
  return { surface, controller, calls, input, emit, point, begin, move, release };
}

test('horizontal native touch takes ownership during dispatch and survives pointer cancellation', () => {
  const s = scene();
  s.emit('pointerdown', { pointerType: 'touch', pointerId: 7 });
  assert.equal(s.calls.length, 0, 'the same finger must not start two input streams');
  assert.equal(s.begin().defaultPrevented, false);
  assert.equal(s.move(197).defaultPrevented, false, 'small tap jitter stays native');
  assert.equal(s.move(185).defaultPrevented, true, 'reserve the horizontal gesture before the paint callback');
  s.emit('pointercancel', { pointerType: 'touch', pointerId: 7 });
  s.move(120, 150);
  s.release(120, 150);
  assert.deepEqual(s.calls.map(call => call[0]), ['start', 'move', 'move', 'end']);
  assert.equal(s.calls[2][1].axis, 'x', 'a horizontal swipe cannot turn into reading scroll');
  assert.equal(s.calls.at(-1)[2], false);
  assert.equal(s.calls[0][1].pointerId, s.calls.at(-1)[1].pointerId);
  assert.equal(s.calls[0][1].target, s.surface);
});

test('vertical reading stays native, even after the finger later travels sideways', () => {
  const s = scene();
  s.begin();
  assert.equal(s.move(198, 120).defaultPrevented, false);
  assert.equal(s.move(60, 125).defaultPrevented, false);
  s.release(60, 125);
  assert.deepEqual(s.calls.map(call => call[0]), ['start', 'end']);
  assert.equal(s.calls.at(-1)[2], true);
});

test('a tap remains native and protected links or controls never acquire a swipe', () => {
  const tap = scene();
  tap.begin();
  assert.equal(tap.release(200).defaultPrevented, false);
  assert.deepEqual(tap.calls.map(call => call[0]), ['start', 'end']);
  const link = scene({ accepted: false });
  link.begin();
  assert.equal(link.move(120).defaultPrevented, false);
  link.release(120);
  assert.deepEqual(link.calls.map(call => call[0]), ['start']);
});

test('release uses the final coordinates if no last move event was delivered', () => {
  const s = scene();
  s.begin();
  s.move(180);
  s.release(100);
  assert.deepEqual(s.calls.map(call => call[0]), ['start', 'move', 'move', 'end']);
  assert.equal(s.calls[2][1].clientX, 100);
  assert.equal(s.calls.at(-1)[1].clientX, 100);
});

for (const reason of ['pinch', 'cancel', 'native-scroll', 'missing-finger']) {
  test(`${reason} releases a swipe without blocking the next gesture`, () => {
    const s = scene();
    s.begin();
    s.move(175);
    if (reason === 'pinch') {
      const event = s.emit('touchstart', { touches: [s.point(175), s.point(250, 150, 4)] });
      assert.equal(event.defaultPrevented, false);
    } else if (reason === 'cancel') s.emit('touchcancel');
    else if (reason === 'native-scroll') s.move(160, 100, false);
    else s.emit('touchmove', { touches: [s.point(160, 100, 4)] });
    assert.equal(s.calls.at(-1)[0], 'end');
    assert.equal(s.calls.at(-1)[2], true);
    s.begin();
    s.move(120);
    s.release(120);
    assert.equal(s.calls.at(-1)[2], false);
  });
}

test('a navigation reset and unmount release native touch ownership', () => {
  const s = scene();
  s.begin();
  s.move(180);
  s.input.reset();
  const count = s.calls.length;
  assert.equal(s.move(100).defaultPrevented, false);
  s.release(100);
  assert.equal(s.calls.length, count);
  s.begin();
  s.controller.abort();
  const finalCount = s.calls.length;
  assert.equal(s.move(100).defaultPrevented, false);
  s.release(100);
  s.emit('pointerdown', { pointerType: 'mouse' });
  assert.equal(s.calls.length, finalCount);
});

for (const nativeTouch of [true, false]) {
  test(`mouse/pen and pointer-only touch retain their input path (native touch ${nativeTouch})`, () => {
    const s = scene({ nativeTouch });
    for (const pointerType of nativeTouch ? ['mouse', 'pen'] : ['mouse', 'pen', 'touch']) {
      s.emit('pointerdown', { pointerType });
      s.emit('pointermove', { pointerType });
      s.emit('pointerup', { pointerType });
      assert.deepEqual(s.calls.slice(-3).map(call => call[0]), ['start', 'move', 'end']);
      assert.equal(s.calls.at(-1)[2], false);
      s.emit('lostpointercapture', { pointerType });
      assert.equal(s.calls.at(-1)[2], true);
    }
  });
}

test('native swipes drive the shared panel and strip settling rules in both directions', () => {
  for (const unit of [320, 390, 88]) {
    for (const start of [0, 1, 2]) {
      for (const direction of [-1, 1]) {
        const s = scene();
        const deltaX = -direction * (unit === 88 ? 36 : 64);
        s.begin();
        s.move(200 + deltaX);
        s.release(200 + deltaX);
        const move = s.calls.find(call => call[0] === 'move')[1];
        const settled = settleProjectSwipe({ start, position: start - (move.clientX - 200) / unit,
          deltaX, unit, velocity: 0, touch: unit !== 88, cancelled: s.calls.at(-1)[2] });
        assert.equal(settled, start + direction);
      }
    }
  }
});

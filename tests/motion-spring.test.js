import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionSpring } from '../src/scripts/motion-spring.js';

test('settling begins at the current position and pointer velocity in either direction', () => {
  for (const velocity of [-.004, 0, .004]) {
    const spring = createMotionSpring({ from: .2, to: 1, velocity, unit: 390 });
    assert.ok(Math.abs(spring.sample(0).position - .2) < 1e-12);
    assert.equal(spring.sample(0).velocity, velocity);
    assert.ok(Math.abs((spring.sample(.001).position - .2) / .001 - velocity) < 1e-6);
  }
});

test('slow pulls and fast flicks settle without overshooting their destination', () => {
  for (const direction of [-1, 1]) {
    for (const velocity of [0, .001, .02]) {
      const spring = createMotionSpring({ from: 0, to: direction, velocity: direction * velocity, unit: 1440 });
      let previous = 0;
      for (let elapsed = 0; elapsed <= spring.duration; elapsed += 1) {
        const value = spring.sample(elapsed).position * direction;
        assert.ok(value >= previous && value <= 1);
        previous = value;
      }
      assert.equal(spring.sample(spring.duration).done, true);
      assert.ok(Math.abs(spring.sample(spring.duration).position - direction) * 1440 < .5);
    }
  }
});

test('changing direction preserves momentum briefly, then reaches the new target', () => {
  const first = createMotionSpring({ from: 0, to: 1, unit: 390 });
  const current = first.sample(80);
  const reversed = createMotionSpring({ from: current.position, to: 0, velocity: current.velocity, unit: 390 });
  assert.equal(reversed.sample(0).position, current.position);
  assert.equal(reversed.sample(0).velocity, current.velocity);
  assert.ok(reversed.sample(1).position > current.position);
  assert.equal(reversed.sample(reversed.duration).done, true);
  assert.ok(reversed.sample(reversed.duration).position * 390 < .5);
});

test('frame delays do not change the motion path or settlement', () => {
  const spring = createMotionSpring({ from: .15, to: 1, velocity: .002, unit: 390 });
  const midpoint = spring.sample(160);
  for (let elapsed = 0; elapsed < 160; elapsed += 8) spring.sample(elapsed);
  assert.deepEqual(spring.sample(160), midpoint);
  assert.equal(spring.sample(1500).done, true);
});

test('settlement is subpixel accurate on phone and desktop widths', () => {
  for (const unit of [320, 390, 1440]) {
    const spring = createMotionSpring({ from: .2, to: 1, unit });
    const end = spring.sample(spring.duration);
    assert.ok(spring.duration < 650);
    assert.equal(end.done, true);
    assert.ok(Math.abs(end.position - 1) * unit < .5);
    assert.ok(Math.abs(end.velocity) * unit < .005);
  }
});

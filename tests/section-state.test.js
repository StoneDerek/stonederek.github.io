import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutSwipe, createScrollReveal, sectionDirection, sectionFromPath, settleProjectSwipe } from '../src/scripts/section-state.js';

test('section direction follows the selected sections, including project base paths', () => {
  assert.equal(sectionFromPath('/portfolio/about/index.html'), 'about');
  assert.equal(sectionFromPath('/portfolio/projects/'), 'projects');
  assert.equal(sectionFromPath('/portfolio/'), 'home');
  assert.equal(sectionDirection('projects', 'about'), -1);
  assert.equal(sectionDirection('about', 'projects'), 1);
  assert.equal(sectionDirection('projects', 'projects'), 0);
});

test('upward intent reveals links, down hides them, small reversals do not flicker', () => {
  const nav = createScrollReveal({ hidden: true });
  assert.equal(nav.move(-10), true);
  assert.equal(nav.move(-15), false);
  assert.equal(nav.move(6), false);
  assert.equal(nav.move(-6), false);
  assert.equal(nav.move(35), false);
  assert.equal(nav.move(1), true);
  assert.equal(nav.move(NaN), true);
});

test('About crosses during movement at a reachable distance, without a release step', () => {
  for (const width of [320, 390, 1440]) {
    const swipe = createAboutSwipe(width);
    assert.deepEqual(swipe.move(-100), { travel: 0, commit: false });
    assert.equal(swipe.move(swipe.threshold - 1).commit, false);
    assert.equal(swipe.move(swipe.threshold).commit, true);
    assert.ok(swipe.threshold <= width * .3);
    assert.equal(typeof swipe.release, 'undefined');
  }
});

test('the bump has continuous, nearly one-to-one motion and no threshold jump', () => {
  const swipe = createAboutSwipe(390);
  let previous = 0;
  for (let distance = 1; distance <= 140; distance++) {
    const { travel } = swipe.move(distance);
    assert.ok(travel - previous >= .75 && travel - previous <= 1.001);
    assert.ok(travel >= distance * .92 && travel <= distance);
    previous = travel;
  }
  const below = swipe.move(swipe.threshold - .1).travel;
  const above = swipe.move(swipe.threshold + .1).travel;
  assert.ok(Math.abs(above - below - .2) < .001);
});

test('backtracking before the crossing restores the untouched boundary', () => {
  const swipe = createAboutSwipe(390);
  assert.equal(swipe.move(swipe.threshold - 1).commit, false);
  assert.equal(swipe.move(25).commit, false);
  assert.deepEqual(swipe.move(0), { travel: 0, commit: false });
});

test('short, slow mobile swipes advance a project in either direction', () => {
  for (const unit of [320, 390, 430]) {
    const delta = Math.max(24, Math.min(56, unit * .15));
    for (const direction of [-1, 1]) {
      const input = { start: 2, position: 2 + direction * delta / unit,
        deltaX: -direction * delta, unit, touch: true };
      assert.equal(settleProjectSwipe(input), 2 + direction);
      assert.equal(settleProjectSwipe({ ...input, touch: false }), 2);
      assert.equal(settleProjectSwipe({ ...input, cancelled: true }), 2);
      assert.equal(settleProjectSwipe({ ...input, deltaX: -direction * 16 }), 2);
    }
  }
});

test('gallery settling retains momentum and does not limit long drags to one project', () => {
  assert.equal(settleProjectSwipe({ start: 0, position: .3, velocity: .003, deltaX: -117, unit: 390 }), 1);
  assert.equal(settleProjectSwipe({ start: 0, position: 2.2, deltaX: -858, unit: 390, touch: true }), 2);
});

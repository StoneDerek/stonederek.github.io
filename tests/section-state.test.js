import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutSwipe, createScrollReveal, sectionDirection, sectionFromPath } from '../src/scripts/section-state.js';

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

test('an ordinary rightward project swipe does not arm About; a longer drag crosses a resisted detent', () => {
  for (const width of [320, 390, 1440]) {
    const swipe = createAboutSwipe(width);
    assert.equal(swipe.move(-swipe.threshold * 2).armed, false);
    assert.equal(swipe.release(), false);
    const normal = swipe.move(swipe.threshold * .45);
    assert.equal(normal.armed, false);
    assert.equal(normal.travel, swipe.threshold * .45);
    assert.equal(swipe.release(), false);
    const resistance = swipe.move(swipe.threshold - 1);
    const crossed = swipe.move(swipe.threshold + 1);
    assert.equal(resistance.armed, false);
    assert.equal(crossed.armed, true);
    assert.ok(crossed.travel - resistance.travel > 12);
    assert.ok(crossed.travel < swipe.threshold);
    assert.equal(swipe.release(), true);
  }
});

test('backtracking and pointer cancellation prevent a section change', () => {
  const swipe = createAboutSwipe(390);
  swipe.move(swipe.threshold + 40);
  assert.equal(swipe.move(swipe.threshold - 10).armed, true);
  assert.equal(swipe.move(swipe.threshold - 30).armed, false);
  assert.equal(swipe.release(), false);
  swipe.move(swipe.threshold + 40);
  assert.equal(swipe.release({ cancelled: true }), false);
  assert.equal(swipe.move(-500).armed, false);
  assert.equal(swipe.release(), false);
});

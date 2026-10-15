import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollReveal, galleryFrame, sectionDirection, sectionFromPath, settleProjectSwipe } from '../src/scripts/section-state.js';

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

test('a revealing touch cannot dismiss its own navigation with a small reversal', () => {
  const nav = createScrollReveal({ hidden: true });
  nav.beginTouch();
  assert.equal(nav.move(-24), false);
  assert.equal(nav.move(90), false);
  nav.endTouch();
  nav.beginTouch();
  assert.equal(nav.move(35), false);
  assert.equal(nav.move(1), true, 'the next gesture dismisses without waiting');
  nav.endTouch();
});

test('gallery interaction can immediately dismiss revealed navigation', () => {
  const nav = createScrollReveal({ hidden: true });
  nav.beginTouch();
  nav.move(-40);
  nav.endTouch();
  assert.equal(nav.setHidden(true), true);
});

test('ending or cancelling a touch releases reveal protection', () => {
  const nav = createScrollReveal({ hidden: true });
  nav.beginTouch();
  nav.move(-40);
  nav.endTouch();
  assert.equal(nav.move(36), true, 'wheel input is not delayed after touch');
  nav.beginTouch();
  assert.equal(nav.move(-40), false);
  nav.endTouch();
  assert.equal(nav.move(36), true);
});

test('the links space is reachable beyond the final project without inventing another project', () => {
  for (let position = -1; position < 8; position += .05) {
    const frame = galleryFrame(position, 6);
    assert.ok(frame.position >= 0 && frame.position <= 6);
    assert.ok(frame.project >= 0 && frame.project < 6);
    assert.ok(frame.endProgress >= 0 && frame.endProgress <= 1);
  }
  assert.deepEqual(galleryFrame(6, 6), { position: 6, project: 5, endProgress: 1, links: true });
  assert.equal(galleryFrame(5.49, 6).links, false);
  assert.equal(galleryFrame(5.5, 6).links, true);
  assert.deepEqual(galleryFrame(5, 6), { position: 5, project: 5, endProgress: 0, links: false });
});

test('short, slow mobile swipes advance a project in either direction', () => {
  for (const unit of [320, 390, 430]) {
    const delta = Math.max(18, Math.min(42, unit * .1125));
    for (const direction of [-1, 1]) {
      const input = { start: 2, position: 2 + direction * delta / unit,
        deltaX: -direction * delta, unit, touch: true };
      assert.equal(settleProjectSwipe(input), 2 + direction);
      assert.equal(settleProjectSwipe({ ...input, touch: false }), 2 + direction);
      assert.equal(settleProjectSwipe({ ...input, cancelled: true }), 2);
      assert.equal(settleProjectSwipe({ ...input, deltaX: -direction * 16 }), 2);
    }
  }
});

test('slow desktop swipes commit without travelling halfway across the screen', () => {
  for (const unit of [800, 1440, 1920]) for (const direction of [-1, 1]) {
    const input = { start: 2, position: 2 + direction * 54 / unit, deltaX: -direction * 54, unit };
    assert.equal(settleProjectSwipe(input), 2 + direction);
    assert.equal(settleProjectSwipe({ ...input, deltaX: -direction * 20, position: 2 + direction * 20 / unit }), 2);
    assert.equal(settleProjectSwipe({ ...input, cancelled: true }), 2);
  }
});

test('gallery settling retains momentum and does not limit long drags to one project', () => {
  assert.equal(settleProjectSwipe({ start: 0, position: .3, velocity: .003, deltaX: -117, unit: 390 }), 1);
  assert.equal(settleProjectSwipe({ start: 0, position: 2.2, deltaX: -858, unit: 390, touch: true }), 2);
});

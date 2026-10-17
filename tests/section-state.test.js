import test from 'node:test';
import assert from 'node:assert/strict';
import { galleryFrame, galleryCaptionFrame, settleProjectSwipe } from '../src/scripts/section-state.js';

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

test('caption entry progresses continuously from the selection midpoint to the first project', () => {
  const positions = [1.5, 1.5001, 1.55, 1.6, 1.75, 1.9, 1.9999];
  let previous = -1;
  for (const position of positions) {
    const caption = galleryCaptionFrame(galleryFrame(position, 7), 2);
    assert.ok(caption.reveal >= previous && caption.reveal < 1);
    assert.equal(caption.project, 2);
    previous = caption.reveal;
  }
  assert.equal(galleryCaptionFrame(galleryFrame(1.5, 7), 2).reveal, 0);
  assert.equal(galleryCaptionFrame(galleryFrame(1.75, 7), 2).reveal, .5);
});

test('the midpoint does not request a completed title and reversing uses the same progress', () => {
  const before = galleryCaptionFrame(galleryFrame(1.4999, 7), 2);
  const after = galleryCaptionFrame(galleryFrame(1.5001, 7), 2);
  assert.equal(before.visible, false); assert.equal(after.visible, true);
  assert.equal(before.project, after.project);
  assert.equal(before.reveal, 0); assert.ok(after.reveal < .001);
  for (const position of [0, .5, 1, 1.499]) assert.equal(galleryCaptionFrame(galleryFrame(position, 7), 2).visible, false);
});

test('settled projects use normal title transitions and Links keeps its existing end visibility', () => {
  for (const position of [2, 2.49, 2.51, 3, 4.8, 6, 6.49]) {
    const caption = galleryCaptionFrame(galleryFrame(position, 7), 2);
    assert.equal(caption.reveal, null); assert.equal(caption.visible, true); assert.equal(caption.interactive, true);
  }
  for (const position of [6.5, 7]) {
    const caption = galleryCaptionFrame(galleryFrame(position, 7), 2);
    assert.equal(caption.visible, false); assert.equal(caption.interactive, false); assert.equal(caption.links, true);
  }
});

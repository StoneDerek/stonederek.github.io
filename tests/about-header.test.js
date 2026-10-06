import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutHeader } from '../src/scripts/about-header.js';
import { aboutPalette } from '../src/data/section-palettes.js';

const projects = { accent: '#dcff67', ink: '#17220b' };
const frame = createAboutHeader(projects, aboutPalette);

test('the swipe header exactly matches Projects and About at the page boundaries', () => {
  assert.deepEqual(frame(0), { ...projects, about: false, labelOpacity: 1, linksOpacity: 0 });
  assert.deepEqual(frame(1), { accent: aboutPalette.accent, ink: aboutPalette.ink, about: true, labelOpacity: 1, linksOpacity: 1 });
});

test('the identity switches only while the location label is invisible', () => {
  assert.equal(frame(.499).about, false);
  assert.equal(frame(.5).about, true);
  assert.equal(frame(.5).labelOpacity, 0);
  assert.ok(frame(.499).labelOpacity < .001);
  assert.ok(frame(.501).labelOpacity < .001);
  assert.equal(frame(.25).labelOpacity, 1);
  assert.equal(frame(.75).labelOpacity, 1);
});

test('reversing and re-grabbing restores the same palette and label at the same position', () => {
  const outward = [.1, .3, .49, .51, .7, .95].map(progress => frame(progress));
  [.95, .7, .51, .49, .3, .1].forEach((progress, index) => assert.deepEqual(frame(progress), outward[5 - index]));
});

test('the returning section links reveal continuously late in the swipe', () => {
  let previous = 0;
  for (let step = 0; step <= 1000; step++) {
    const progress = step / 1000;
    const opacity = frame(progress).linksOpacity;
    assert.ok(opacity >= previous && opacity <= 1);
    assert.ok(opacity - previous < .005);
    if (progress <= .65) assert.equal(opacity, 0);
    previous = opacity;
  }
});

test('out-of-range positions cannot overshoot a header endpoint', () => {
  for (const value of [-1, NaN, Infinity]) assert.deepEqual(frame(value), frame(0));
  assert.deepEqual(frame(2), frame(1));
});

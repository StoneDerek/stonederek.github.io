import test from 'node:test';
import assert from 'node:assert/strict';
import { fitImage, zoomImage, panImage, resizeImage } from '../src/scripts/image-zoom.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
const sourcePoint = (image, point) => ({
  x: (point.x - image.x) / (image.zoom * image.fit),
  y: (point.y - image.y) / (image.zoom * image.fit)
});

test('zoom keeps the chosen source point under the cursor, including repeated zoom out', () => {
  let image = fitImage(4000, 3000, 800, 600);
  const point = { x: 220, y: 430 }, source = sourcePoint(image, point);
  for (const level of [1.3, 2.7, 4.9, 3, 1.7, 1]) {
    image = zoomImage(image, level, point);
    const next = sourcePoint(image, point);
    near(next.x, source.x); near(next.y, source.y);
  }
});

test('pan boundaries keep every image edge reachable without exposing empty space', () => {
  for (const [width, height] of [[4000, 3000], [3000, 4000], [4000, 500], [500, 4000]]) {
    const image = zoomImage(fitImage(width, height, 800, 600), 100);
    const start = panImage(image, 1e6, 1e6), end = panImage(image, -1e6, -1e6);
    const expectedX = width <= 800 ? (800 - width) / 2 : 0;
    const expectedY = height <= 600 ? (600 - height) / 2 : 0;
    near(start.x, expectedX); near(start.y, expectedY);
    near(end.x, width <= 800 ? expectedX : 800 - width);
    near(end.y, height <= 600 ? expectedY : 600 - height);
  }
});

test('zoom stops at source resolution and never makes a small photo blurry', () => {
  for (const [width, height] of [[4000, 3000], [1440, 1080], [160, 100]]) {
    const image = zoomImage(fitImage(width, height, 800, 600), 100);
    near(image.width * image.zoom, width);
    near(image.height * image.zoom, height);
    const fitted = zoomImage(image, .001);
    near(fitted.zoom, 1);
    assert.ok(fitted.width <= 800 && fitted.height <= 600);
  }
});

test('resize retains the inspected source point and pixel scale instead of resetting fit', () => {
  const image = panImage(zoomImage(fitImage(4000, 3000, 800, 600), 3), -120, -80);
  const before = sourcePoint(image, { x: 400, y: 300 });
  const resized = resizeImage(image, fitImage(4000, 3000, 390, 740));
  const after = sourcePoint(resized, { x: 195, y: 370 });
  near(after.x, before.x); near(after.y, before.y);
  near(resized.zoom * resized.fit, image.zoom * image.fit);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { articleRevealOrigin, createTileCells } from '../src/scripts/project-transition.js';

test('the first replacement tiles reach the heading within the first moving frame', () => {
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
    const bounds = { left: 20, top: 240, width: width * .4, height: 96 };
    const origin = articleRevealOrigin(bounds, width, height);
    const x = origin.x * width, y = origin.y * height;
    const cell = createTileCells(width, height, origin).find(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
    assert.ok(cell.order * 420 < 33, `first content tile at ${width}px starts after ${cell.order * 420}ms`);
  }
});

test('offscreen or unavailable headings produce bounded, finite reveal origins', () => {
  assert.deepEqual(articleRevealOrigin(null, 390, 844), { x: .5, y: .5 });
  assert.deepEqual(articleRevealOrigin({ left: NaN, top: 0, width: 30, height: 40 }, 390, 844), { x: .5, y: .5 });
  assert.deepEqual(articleRevealOrigin({ left: -100, top: 999, width: 10, height: 40 }, 390, 844), { x: 0, y: 1 });
});

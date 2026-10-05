import test from 'node:test';
import assert from 'node:assert/strict';
import { createTileCells, settleTiles } from '../src/scripts/project-transition.js';

const viewports = [[320, 568], [390, 844], [844, 390], [1440, 900], [2048, 1048], [3840, 2160]];

for (const [width, height] of viewports) {
  test(`tile masks cover ${width} × ${height} without gaps and stay within the work budget`, () => {
    const cells = createTileCells(width, height, { x: .5, y: .5 });
    assert.ok(cells.length <= 1400);
    assert.equal(cells.reduce((area, cell) => area + cell.w * cell.h, 0), width * height);
    const rows = Map.groupBy(cells, cell => cell.y);
    let nextY = 0;
    for (const [y, row] of rows) {
      assert.equal(y, nextY);
      let nextX = 0;
      for (const cell of row) {
        assert.equal(cell.x, nextX);
        assert.ok(cell.w > 0 && cell.h > 0);
        assert.ok(cell.x + cell.w <= width && cell.y + cell.h <= height);
        assert.ok(Number.isFinite(cell.order) && cell.order >= 0 && cell.order <= 1);
        assert.ok(Number.isInteger(cell.group) && cell.group >= 0 && cell.group < 4);
        nextX += cell.w;
      }
      assert.equal(nextX, width);
      nextY += row[0].h;
    }
    assert.equal(nextY, height);
    if (width <= 844 && height <= 844) assert.equal(cells[0].w, 24);
  });
}

test('the first tiles follow a click at either corner, rather than a fixed center', () => {
  const nearest = origin => createTileCells(390, 844, origin).reduce((a, b) => a.order < b.order ? a : b);
  const topLeft = nearest({ x: 0, y: 0 });
  const bottomRight = nearest({ x: 1, y: 1 });
  assert.ok(topLeft.x < 48 && topLeft.y < 48);
  assert.ok(bottomRight.x > 320 && bottomRight.y > 770);
});

test('invalid viewport measurements are harmless and offscreen clicks are bounded', () => {
  for (const [w, h] of [[0, 844], [390, 0], [-1, 844], [NaN, 900], [Infinity, 900]]) {
    assert.deepEqual(createTileCells(w, h), []);
  }
  assert.deepEqual(createTileCells(390, 844, { x: -20, y: 10 }), createTileCells(390, 844, { x: 0, y: 1 }));
  assert.deepEqual(createTileCells(390, 844, { x: NaN, y: Infinity }), createTileCells(390, 844));
});

test('reduced motion and pre-aborted transitions do not clone or hide the article', async () => {
  const root = { append() { assert.fail('should not create a transition layer'); } };
  const page = { cloneNode() { assert.fail('should not copy article'); }, style: { opacity: '' } };
  await settleTiles(root, page, { opening: true, reducedMotion: true });
  const controller = new AbortController();
  controller.abort();
  await settleTiles(root, page, { opening: false, signal: controller.signal });
  assert.equal(page.style.opacity, '');
});

test('unsupported mask rendering leaves the article available', async () => {
  const previousCSS = globalThis.CSS;
  try {
    globalThis.CSS = { supports: () => false };
    await settleTiles(null, null, { opening: true });
  } finally { globalThis.CSS = previousCSS; }
});

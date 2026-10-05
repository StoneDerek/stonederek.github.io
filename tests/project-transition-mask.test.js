import test from 'node:test';
import assert from 'node:assert/strict';
import { createTileCells, createTileMask } from '../src/scripts/project-transition.js';

// Preserve the original independent rectangles as a geometry reference. Merging
// settled tiles must reduce path work without changing any revealed article area.
function referenceRects(cells, elapsed, { opening, travel, duration }) {
  const offsets = [[-14, -10], [13, -12], [-12, 13], [14, 10]];
  const round = value => Math.round(value * 100) / 100;
  return cells.flatMap(cell => {
    const order = opening ? cell.order : 1 - cell.order;
    const t = Math.max(0, Math.min(1, (elapsed - order * travel) / duration));
    const progress = 1 - (1 - t) ** 3;
    const scale = opening ? progress : 1 - progress;
    const w = (cell.w + .6) * scale;
    const h = (cell.h + .6) * scale;
    if (round(w) <= 0 || round(h) <= 0) return [];
    const shift = opening ? 1 - progress : progress;
    const [dx, dy] = offsets[cell.group];
    return [{ x: round(cell.x + (cell.w - w) / 2 + dx * shift),
      y: round(cell.y + (cell.h - h) / 2 + dy * shift), w: round(w), h: round(h) }];
  });
}

function parseRects(path) {
  return [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)h([\d.]+)v([\d.]+)h(-?[\d.]+)Z/g)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]) }));
}

function intervalsAt(rects, y) {
  const spans = rects.filter(rect => y > rect.y && y < rect.y + rect.h)
    .map(rect => [Math.round(rect.x * 100), Math.round((rect.x + rect.w) * 100)])
    .sort((a, b) => a[0] - b[0]);
  const union = [];
  for (const span of spans) {
    const last = union.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else union.push(span);
  }
  return union;
}

function sameCoverage(actual, expected) {
  const edges = [...new Set([...actual, ...expected].flatMap(rect => [rect.y, rect.y + rect.h])
    .map(y => Math.round(y * 100)))].sort((a, b) => a - b);
  for (let i = 1; i < edges.length; i++) {
    const y = (edges[i - 1] + edges[i]) / 200;
    assert.deepEqual(intervalsAt(actual, y), intervalsAt(expected, y), `mask coverage at y=${y}`);
  }
}

for (const opening of [true, false]) {
  for (const [width, height, origin] of [
    [390, 844, { x: .5, y: .5 }],
    [844, 390, { x: 0, y: 1 }],
    [1440, 900, { x: .18, y: .82 }]
  ]) {
    test(`merged ${opening ? 'opening' : 'closing'} masks preserve every revealed region at ${width} × ${height}`, () => {
      const options = { opening, travel: opening ? 420 : 240, duration: opening ? 250 : 180 };
      const cells = createTileCells(width, height, origin);
      const mask = createTileMask(cells, options);
      const total = options.travel + options.duration;
      // Include a backwards time sample to ensure no cache depends on frame order.
      for (const time of [0, total * .14, total * .4, total * .72, total - .5, total, total * .3]) {
        sameCoverage(parseRects(mask(time)), referenceRects(cells, time, options));
      }
    });
  }
}

test('fully settled masks collapse to one shape per row rather than one per tile', () => {
  const cells = createTileCells(3840, 2160);
  const mask = createTileMask(cells, { opening: true, travel: 420, duration: 250 });
  const rects = parseRects(mask(670));
  assert.equal(rects.length, new Set(cells.map(cell => cell.y)).size);
  assert.ok(rects.length < cells.length / 20);
  sameCoverage(rects, referenceRects(cells, 670, { opening: true, travel: 420, duration: 250 }));
});

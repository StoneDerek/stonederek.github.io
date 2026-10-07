import test from 'node:test';
import assert from 'node:assert/strict';
import { unitVector, prismVertices, insidePrism, rayIntersection, refractRay, tracePrismRay } from '../src/scripts/prism-optics.js';
import { asciiCell, logoStencil, nearestInk } from '../src/scripts/prism-ascii.js';

test('a normal-incidence ray stays straight across an air/glass interface', () => {
  const result = refractRay({ x: 1, y: 0 }, { x: -1, y: 0 }, 1 / 1.5);
  assert.equal(result.reflected, false);
  assert.deepEqual(result.direction, { x: 1, y: 0 });
});
test('refraction obeys Snell and total internal reflection stays finite', () => {
  const direction = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
  const result = refractRay(direction, { x: -1, y: 0 }, 1 / 1.5);
  assert.ok(Math.abs(result.direction.y - 1 / 3) < 1e-10);
  const internal = refractRay(unitVector({ x: 1, y: 2 }), { x: -1, y: 0 }, 1.5);
  assert.equal(internal.reflected, true);
  assert.ok(internal.direction.x < 0 && internal.direction.y > 0);
  assert.ok(Math.abs(Math.hypot(internal.direction.x, internal.direction.y) - 1) < 1e-10);
});
test('ray/edge intersections ignore parallel and backward edges', () => {
  assert.equal(rayIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }), null);
  assert.equal(rayIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: -1 }, { x: -1, y: 1 }), null);
  assert.equal(rayIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 1 }).distance, 2);
});
test('a prism ray enters, refracts inside, exits, and disperses with index', () => {
  const triangle = prismVertices({ x: 300, y: 240 }, 90), source = { x: 60, y: 204 };
  assert.equal(insidePrism(source, triangle), false);
  assert.equal(insidePrism({ x: 300, y: 240 }, triangle), true);
  const trace = index => tracePrismRay(source, { x: 1, y: 0 }, triangle, index, 1500);
  const red = trace(1.49), violet = trace(1.56);
  assert.deepEqual(red.map(segment => segment.inside), [false, true, false]);
  const angle = segments => { const s = segments.at(-1); return Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x); };
  assert.ok(angle(violet) > angle(red));
});
test('the prism points left with a vertical exit face, and a fixed beam can miss it', () => {
  const triangle = prismVertices({ x: 300, y: 240 }, 90);
  assert.deepEqual(triangle[0], { x: 210, y: 240 });
  assert.equal(triangle[1].x, triangle[2].x);
  assert.ok(triangle[1].y < 240 && triangle[2].y > 240);
  const source = { x: 60, y: 100 };
  assert.deepEqual(tracePrismRay(source, { x: 1, y: 0 }, triangle, 1.5, 1500),
    [{ from: source, to: { x: 1560, y: 100 }, inside: false }]);
});
test('overlapping source/prism and internal reflection cannot produce infinite traces', () => {
  const triangle = prismVertices({ x: 100, y: 100 }, 60);
  for (const source of [{ x: 100, y: 100 }, ...triangle, { x: 5, y: 5 }]) {
    const segments = tracePrismRay(source, { x: 100 - source.x, y: 100 - source.y }, triangle, 1.6, 1000);
    assert.ok(segments.length > 0 && segments.length <= 7);
    assert.ok(segments.every(s => [s.from.x, s.from.y, s.to.x, s.to.y].every(Number.isFinite)));
  }
});
test('the ds. stencil always produces dark glyphs regardless of illumination', () => {
  for (const coverage of [0, .1, .5, 1]) for (const luminance of [0, .5, 1]) {
    assert.deepEqual(asciiCell(coverage, luminance, 4, -4, true), { glyph: '#', ink: 0 });
  }
  assert.equal(asciiCell(0, 0).glyph, ' ');
  assert.equal(asciiCell(1, 1).glyph, ' ', 'White samples remain blank instead of becoming dense ink');
  assert.equal(nearestInk(21, 21, 21), 0);
});
test('the fixed logo stencil fits phone and desktop grids and keeps the dot separate', () => {
  for (const [columns, rows, scale] of [[44, 38, 1], [144, 44, 2]]) {
    const stencil = logoStencil(columns, rows, columns * .78, rows * .55, scale);
    assert.equal(stencil.length, columns * rows);
    assert.ok(stencil.some(Boolean));
    assert.deepEqual(stencil, logoStencil(columns, rows, columns * .78, rows * .55, scale));
    const occupied = [];
    for (let x = 0; x < columns; x++) if (stencil.some((value, i) => value && i % columns === x)) occupied.push(x);
    assert.ok(occupied.some((column, i) => i && column > occupied[i - 1] + 1), 'Letter and dot gaps remain unlit space');
  }
});

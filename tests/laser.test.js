import test from 'node:test';
import assert from 'node:assert/strict';
import { laserPuzzle, mirrorEndpoints, reflectRay, traceLaser } from '../src/scripts/laser-optics.js';
import { asciiCell, logoStencil, nearestInk } from '../src/scripts/ascii-grid.js';

test('reflection keeps its speed and reverses the normal component', () => {
  assert.deepEqual(reflectRay({ x: 1, y: 0 }, 0), { x: 1, y: 0 });
  const reflected = reflectRay({ x: 1, y: 0 }, Math.PI / 4);
  assert.ok(Math.abs(reflected.x) < 1e-10 && Math.abs(reflected.y - 1) < 1e-10);
  assert.ok(Math.abs(Math.hypot(reflected.x, reflected.y) - 1) < 1e-10);
});
test('a mirror is a finite segment rather than an infinite reflecting plane', () => {
  const puzzle = laserPuzzle(800, 500, [Math.PI / 2, 0]);
  puzzle.source.y = 1;
  assert.deepEqual(traceLaser(puzzle).segments.map(s => s.event), ['edge']);
  assert.equal(mirrorEndpoints(puzzle.mirrors[0]).length, 2);
});
test('both mirrors can solve the puzzle at desktop, phone, and landscape dimensions', () => {
  for (const [width, height] of [[1040, 624], [343, 524], [272, 248], [796, 138]]) {
    const puzzle = laserPuzzle(width, height, [0, 0]);
    const [first, second] = puzzle.mirrors;
    const incoming = Math.atan2(second.y - first.y, second.x - first.x);
    const outgoing = Math.atan2(puzzle.target.y - second.y, puzzle.target.x - second.x);
    first.angle = incoming / 2; second.angle = (incoming + outgoing) / 2;
    const result = traceLaser(puzzle);
    assert.equal(result.hit, true);
    assert.deepEqual(result.segments.map(s => s.event), ['mirror', 'mirror', 'target']);
  }
});
test('the start is unsolved and moving a mirror angle does not aim the source', () => {
  const puzzle = laserPuzzle(800, 500, [Math.PI / 2, Math.PI / 6]);
  assert.equal(traceLaser(puzzle).hit, false);
  assert.equal(traceLaser(puzzle).segments[0].mirror, 0);
  puzzle.mirrors[0].angle = .4;
  assert.deepEqual(puzzle.direction, { x: 1, y: 0 });
});
test('the blocker absorbs direct and single-mirror shortcuts at every layout', () => {
  for (const [width, height] of [[1040, 624], [343, 524], [272, 248], [796, 138]]) {
    const puzzle = laserPuzzle(width, height, [0, Math.PI / 6]);
    assert.equal(traceLaser(puzzle).segments.at(-1).event, 'wall');
    const first = puzzle.mirrors[0];
    first.angle = Math.atan2(puzzle.target.y - first.y, puzzle.target.x - first.x) / 2;
    const result = traceLaser(puzzle);
    assert.equal(result.hit, false);
    assert.deepEqual(result.segments.map(s => s.event), ['mirror', 'wall']);
  }
});
test('parallel, overlapping, and repeated mirror hits remain finite and bounded', () => {
  for (const angle of [0, Math.PI / 2, Math.PI / 4]) {
    const puzzle = laserPuzzle(800, 500, [angle, angle]);
    puzzle.mirrors[1] = { ...puzzle.mirrors[0] };
    const result = traceLaser(puzzle);
    assert.ok(result.segments.length > 0 && result.segments.length <= 13);
    assert.ok(result.segments.every(s => [s.from.x, s.from.y, s.to.x, s.to.y].every(Number.isFinite)));
  }
});
test('a target before a mirror receives the beam before reflection', () => {
  const puzzle = laserPuzzle(800, 500, [Math.PI / 2, 0]);
  puzzle.target.x = 150; puzzle.target.y = puzzle.source.y;
  assert.deepEqual(traceLaser(puzzle).segments.map(s => s.event), ['target']);
});
test('the ds. stencil stays dark regardless of beam illumination', () => {
  for (const coverage of [0, .1, .5, 1]) for (const luminance of [0, .5, 1]) {
    assert.deepEqual(asciiCell(coverage, luminance, 4, -4, true), { glyph: '#', ink: 0 });
  }
  assert.equal(asciiCell(0, 0).glyph, ' ');
  assert.equal(asciiCell(1, 1).glyph, ' ');
  assert.equal(nearestInk(21, 21, 21), 0);
});
test('the logo fits narrow and wide grids and leaves letter/dot spacing', () => {
  for (const [columns, rows, scale] of [[43, 18, 1], [144, 44, 2]]) {
    const stencil = logoStencil(columns, rows, columns * .2, rows * .2, scale);
    assert.equal(stencil.length, columns * rows);
    assert.ok(stencil.some(Boolean));
    const occupied = [];
    for (let x = 0; x < columns; x++) if (stencil.some((value, i) => value && i % columns === x)) occupied.push(x);
    assert.ok(occupied.some((column, i) => i && column > occupied[i - 1] + 1));
  }
});

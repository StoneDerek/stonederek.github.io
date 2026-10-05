import { performance } from 'node:perf_hooks';
import { createTileCells, createTileMask } from '../src/scripts/project-transition.js';
const offsets = [[-14, -10], [13, -12], [-12, 13], [14, 10]];

// Compare mask generation with the previous, independent-rectangle renderer.
// This measures JavaScript and path size, not browser paint or device battery use.
function previousMask(cells, elapsed, { opening, travel, duration }) {
  const round = value => Math.round(value * 100) / 100;
  return cells.map(cell => {
    const order = opening ? cell.order : 1 - cell.order;
    const t = Math.max(0, Math.min(1, (elapsed - order * travel) / duration));
    const progress = 1 - (1 - t) ** 3;
    const scale = opening ? progress : 1 - progress;
    if (scale <= 0) return '';
    const w = (cell.w + .6) * scale;
    const h = (cell.h + .6) * scale;
    if (round(w) <= 0 || round(h) <= 0) return '';
    const [dx, dy] = offsets[cell.group];
    const shift = opening ? 1 - progress : progress;
    const x = cell.x + (cell.w - w) / 2 + dx * shift;
    const y = cell.y + (cell.h - h) / 2 + dy * shift;
    return `M${round(x)} ${round(y)}h${round(w)}v${round(h)}h${round(-w)}Z`;
  }).filter(Boolean).join(' ');
}

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
let checksum = 0;
const results = [];
for (const [width, height] of [[390, 844], [1440, 900], [3840, 2160]]) {
  const cells = createTileCells(width, height);
  const cases = [true, false].map(opening => {
    const options = { opening, travel: opening ? 420 : 240, duration: opening ? 250 : 180 };
    const frames = [];
    for (let time = 1000 / 60; time < options.travel + options.duration; time += 1000 / 60) frames.push(time);
    return { options, frames };
  });
  const run = optimized => {
    for (const { options, frames } of cases) {
      const mask = optimized ? createTileMask(cells, options) : time => previousMask(cells, time, options);
      for (const time of frames) checksum += mask(time).length;
    }
  };
  for (let warmup = 0; warmup < 12; warmup++) { run(false); run(true); }
  const oldTimes = [];
  const newTimes = [];
  for (let round = 0; round < 9; round++) {
    for (const optimized of round % 2 ? [true, false] : [false, true]) {
      const start = performance.now();
      for (let repeat = 0; repeat < 12; repeat++) run(optimized);
      (optimized ? newTimes : oldTimes).push((performance.now() - start) / 12);
    }
  }
  let oldCharacters = 0;
  let newCharacters = 0;
  for (const { options, frames } of cases) {
    const mask = createTileMask(cells, options);
    for (const time of frames) {
      oldCharacters += previousMask(cells, time, options).length;
      newCharacters += mask(time).length;
    }
  }
  const previous = median(oldTimes);
  const optimized = median(newTimes);
  results.push({ viewport: `${width} × ${height}`, cells: cells.length,
    previousMs: Number(previous.toFixed(2)), optimizedMs: Number(optimized.toFixed(2)),
    lessMaskCPU: `${Math.round((1 - optimized / previous) * 100)}%`,
    smallerPaths: `${Math.round((1 - newCharacters / oldCharacters) * 100)}%` });
}
console.log('Median mask-generation time for one opening + closing at 60 Hz, including mask setup:');
console.table(results);
if (!checksum) throw new Error('Benchmark did not generate any masks.');

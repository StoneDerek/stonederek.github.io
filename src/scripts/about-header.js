import { interpolatePalette } from './header-palette.js';

const clamp = value => Math.max(0, Math.min(1, value));
const smoothstep = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// Derive the whole header from the drawn page position, so reversing a swipe
// also reverses its identity without leaving a timed animation behind.
export function createAboutHeader(from, to) {
  return value => {
    const progress = clamp(Number.isFinite(value) ? value : 0);
    const palette = interpolatePalette(from, to, progress);
    return {
      ...palette,
      about: progress >= .5,
      labelOpacity: progress < .5 ? 1 - smoothstep((progress - .25) / .25) : smoothstep((progress - .5) / .25),
      linksOpacity: smoothstep((progress - .65) / .35)
    };
  };
}

const clamp = value => Math.max(0, Math.min(1, value));
const smoothstep = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const channels = color => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));

// Derive the whole header from the drawn page position, so reversing a swipe
// also reverses its identity without leaving a timed animation behind.
export function createAboutHeader(from, to) {
  const colors = ['accent', 'ink'].map(key => ({ key, from: channels(from[key]), to: channels(to[key]) }));
  return value => {
    const progress = clamp(Number.isFinite(value) ? value : 0);
    const palette = Object.fromEntries(colors.map(color => [color.key,
      progress === 0 ? from[color.key] : progress === 1 ? to[color.key]
        : `rgb(${color.from.map((channel, i) => Math.round(channel + (color.to[i] - channel) * progress)).join(', ')})`
    ]));
    return {
      ...palette,
      about: progress >= .5,
      labelOpacity: progress < .5 ? 1 - smoothstep((progress - .25) / .25) : smoothstep((progress - .5) / .25),
      linksOpacity: smoothstep((progress - .65) / .35)
    };
  };
}

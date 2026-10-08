const channels = color => {
  if (!color.startsWith('#')) {
    const values = color.match(/[\d.]+/g).slice(0, 3).map(Number);
    return color.startsWith('color(srgb ') ? values.map(value => value * 255) : values;
  }
  const hex = color.length === 4 ? `#${[...color.slice(1)].map(value => value + value).join('')}` : color;
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
};
const luminance = color => channels(color).reduce((sum, value, i) => {
  const c = value / 255;
  return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
}, 0);
const blends = new WeakMap();

export function stopHeaderPalette(header) { blends.get(header)?.(); }

export function interpolatePalette(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const keys = from.selection && to.selection ? ['accent', 'ink', 'selection'] : ['accent', 'ink'];
  if (from.selectionInk && to.selectionInk) keys.push('selectionInk');
  const palette = Object.fromEntries(keys.map(key => {
    if (t === 0 || t === 1) return [key, (t ? to : from)[key]];
    const a = channels(from[key]), b = channels(to[key]);
    return [key, `rgb(${a.map((value, i) => Math.round(value + (b[i] - value) * t)).join(', ')})`];
  }));
  // Opposite text polarities cannot cross through gray legibly. Keep the
  // background continuous and switch ink when its blended contrast is too low.
  const background = luminance(palette.accent), ink = luminance(palette.ink);
  if (t > 0 && t < 1 && (Math.max(background, ink) + .05) / (Math.min(background, ink) + .05) < 4.5) {
    palette.ink = background > .179 ? '#000' : '#fff';
  }
  if (palette.selection && palette.selectionInk && t > 0 && t < 1) {
    const selected = luminance(palette.selection), selectedInk = luminance(palette.selectionInk);
    if ((Math.max(selected, selectedInk) + .05) / (Math.min(selected, selectedInk) + .05) < 4.5) {
      palette.selectionInk = selected > .179 ? '#000' : '#fff';
    }
  }
  return palette;
}

export function readHeaderPalette(header = document.querySelector('.site-header')) {
  const menu = header?.querySelector('.site-menu');
  if (!menu) return null;
  const selected = header.querySelector('.page-links a[aria-current="page"]');
  return { accent: getComputedStyle(menu).backgroundColor, ink: getComputedStyle(header).color,
    ...(selected ? { selection: getComputedStyle(selected).backgroundColor, selectionInk: getComputedStyle(selected).color } : {}) };
}

// Blend opaque colors on the incoming live header. Fading the entire header
// would wash out its tint against the white page at the middle of a handoff.
export function blendHeaderPalette(header, from, { duration = 180 } = {}) {
  stopHeaderPalette(header);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const style = header && getComputedStyle(header);
  // Read destination variables, since a gallery mount can already be blending
  // the first cover's displayed colors toward a directly requested project.
  const to = style ? { accent: style.getPropertyValue('--accent').trim(), ink: style.getPropertyValue('--ink').trim() } : null;
  if (!from || !to?.accent || !to.ink || reducedMotion.matches || document.hidden) return () => {};
  const selected = header.querySelector('.page-links a[aria-current="page"]');
  if (from.selection && selected) {
    to.selection = getComputedStyle(selected).backgroundColor;
    to.selectionInk = getComputedStyle(selected).color;
  }
  const controller = new AbortController();
  const saved = ['--accent', '--ink', '--nav-selection', '--nav-selection-ink'].map(name => [name, header.style.getPropertyValue(name), header.style.getPropertyPriority(name)]);
  let frame = 0, finished = false;
  const apply = palette => {
    header.style.setProperty('--accent', palette.accent);
    header.style.setProperty('--ink', palette.ink);
    if (palette.selection) header.style.setProperty('--nav-selection', palette.selection);
    if (palette.selectionInk) header.style.setProperty('--nav-selection-ink', palette.selectionInk);
  };
  const finish = () => {
    if (finished) return;
    finished = true; cancelAnimationFrame(frame); controller.abort();
    for (const [name, value, priority] of saved) {
      if (value) header.style.setProperty(name, value, priority);
      else header.style.removeProperty(name);
    }
    // Flush the restored colors while the local CSS transitions are disabled.
    readHeaderPalette(header);
    delete header.dataset.paletteMotion;
    blends.delete(header);
  };
  blends.set(header, finish);
  header.dataset.paletteMotion = 'true'; apply(from);
  const start = performance.now();
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    if (progress >= 1) { finish(); return; }
    apply(interpolatePalette(from, to, 1 - (1 - progress) ** 3));
    frame = requestAnimationFrame(tick);
  };
  reducedMotion.addEventListener('change', event => { if (event.matches) finish(); }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); }, { signal: controller.signal });
  frame = requestAnimationFrame(tick);
  return finish;
}

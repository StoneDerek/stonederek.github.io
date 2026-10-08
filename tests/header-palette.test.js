import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolatePalette, readHeaderPalette, blendHeaderPalette } from '../src/scripts/header-palette.js';
import projects from '../src/data/projects.json' with { type: 'json' };
import { homePalette, aboutPalette, linksPalette } from '../src/data/section-palettes.js';

const from = { accent: '#ded3ff', ink: '#241a36' }, to = { accent: '#cde9ff', ink: '#1b2b43' };
test('palette blends have exact endpoints and reversible opaque RGB intermediate colors', () => {
  assert.deepEqual(interpolatePalette(from, to, 0), from);
  assert.deepEqual(interpolatePalette(from, to, 1), to);
  assert.deepEqual(interpolatePalette(from, to, .5), { accent: 'rgb(214, 222, 255)', ink: 'rgb(32, 35, 61)' });
  const rgb = { accent: 'rgb(222, 211, 255)', ink: 'rgb(36, 26, 54)' };
  for (const t of [.1, .25, .5, .75, .9]) {
    assert.deepEqual(interpolatePalette(rgb, to, t), interpolatePalette(to, rgb, 1 - t));
  }
});

test('short hex and computed sRGB selection colors blend without losing their tint', () => {
  assert.deepEqual(interpolatePalette({ accent: '#fff', ink: '#000', selection: 'color(srgb 1 0.8 0.6)' },
    { accent: '#000', ink: '#fff', selection: '#e4e4e7' }, .5),
    { accent: 'rgb(128, 128, 128)', ink: '#000', selection: 'rgb(242, 216, 192)' });
});

const rgb = color => {
  if (!color.startsWith('#')) return color.match(/[\d.]+/g).slice(0, 3).map(Number);
  const hex = color.length === 4 ? `#${[...color.slice(1)].map(c => c + c).join('')}` : color;
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
};
const luminance = color => rgb(color).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; })
  .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
test('text stays readable throughout every project and section palette blend', () => {
  const palettes = [homePalette, aboutPalette, linksPalette, ...projects.map(project => project.palette)];
  for (const a of palettes) for (const b of palettes) for (let i = 0; i <= 100; i++) {
    const p = interpolatePalette(a, b, i / 100);
    const background = luminance(p.accent), ink = luminance(p.ink);
    const contrast = (Math.max(background, ink) + .05) / (Math.min(background, ink) + .05);
    assert.ok(contrast >= 4.5, `${a.accent} → ${b.accent} at ${i}%: ${contrast}`);
  }
});

function scene({ reduced = false } = {}) {
  const names = ['window', 'document', 'getComputedStyle', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const properties = new Map(), frames = new Map(), media = new EventTarget(), events = new EventTarget();
  let clock = 0, sequence = 0, destination = to;
  media.matches = reduced;
  const header = { dataset: {}, style: {
    getPropertyValue: name => properties.get(name)?.value || '', getPropertyPriority: name => properties.get(name)?.priority || '',
    setProperty: (name, value, priority = '') => properties.set(name, { value, priority }), removeProperty: name => properties.delete(name)
  }, querySelector: selector => selector === '.site-menu' ? menu : null };
  const menu = {};
  Object.assign(globalThis, {
    window: { matchMedia: () => media },
    document: { hidden: false, querySelector: () => header, addEventListener: (...args) => events.addEventListener(...args) },
    getComputedStyle: node => node === header ? { color: properties.get('--ink')?.value || destination.ink,
      getPropertyValue: name => properties.get(name)?.value || destination[name === '--accent' ? 'accent' : 'ink'] }
      : { backgroundColor: properties.get('--accent')?.value || destination.accent },
    performance: { now: () => clock },
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; }, cancelAnimationFrame: id => frames.delete(id)
  });
  return { header, media, frames,
    setDestination(palette) { destination = palette; },
    advance(time) { clock = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); },
    hide() { document.hidden = true; events.dispatchEvent(new Event('visibilitychange')); },
    restore() { for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } }
  };
}

test('a section starts with the outgoing palette and blends while keeping the header opaque', () => {
  const s = scene(); let finish;
  try {
    finish = blendHeaderPalette(s.header, from);
    assert.deepEqual(readHeaderPalette(s.header), from);
    s.advance(90); const middle = readHeaderPalette(s.header);
    assert.notDeepEqual(middle, from); assert.notDeepEqual(middle, to);
    assert.equal(s.header.style.getPropertyValue('opacity'), '');
    s.advance(180);
    assert.deepEqual(readHeaderPalette(s.header), to);
    assert.equal(s.header.style.getPropertyValue('--accent'), '');
    assert.equal(s.header.dataset.paletteMotion, undefined); assert.equal(s.frames.size, 0);
  } finally { finish?.(); s.restore(); }
});

test('cancellation and reduced motion release palette overrides and animation frames', () => {
  for (const reduced of [false, true]) {
    const s = scene({ reduced }); let finish;
    try {
      finish = blendHeaderPalette(s.header, from); s.advance(45); finish(); s.advance(1000);
      assert.deepEqual(readHeaderPalette(s.header), to); assert.equal(s.frames.size, 0);
      assert.equal(s.header.dataset.paletteMotion, undefined);
    } finally { finish?.(); s.restore(); }
  }
});

test('a rapid reversal continues from the visible palette and cancels the old frame loop', () => {
  const s = scene(); let oldFinish, finish;
  try {
    oldFinish = blendHeaderPalette(s.header, from); s.advance(45);
    const visible = readHeaderPalette(s.header);
    s.setDestination(from);
    finish = blendHeaderPalette(s.header, visible);
    oldFinish();
    assert.deepEqual(readHeaderPalette(s.header), visible);
    assert.equal(s.frames.size, 1);
    s.advance(225);
    assert.deepEqual(readHeaderPalette(s.header), from); assert.equal(s.frames.size, 0);
    assert.equal(s.header.dataset.paletteMotion, undefined);
  } finally { finish?.(); oldFinish?.(); s.restore(); }
});

test('hiding the page finishes the blend and releases its override', () => {
  const s = scene(); let finish;
  try {
    finish = blendHeaderPalette(s.header, from); s.advance(45);
    // The same visibility event used by the real document must release the loop.
    s.hide();
    assert.deepEqual(readHeaderPalette(s.header), to); assert.equal(s.frames.size, 0);
    assert.equal(s.header.dataset.paletteMotion, undefined);
  } finally { finish?.(); s.restore(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { imagePaintBounds, intersectRectangles, sourceImageInk, navigationInkTiles, mountNavigationContrast } from '../src/scripts/navigation-contrast.js';

test('contrast zones begin at the actual image edge and respect carousel clipping', () => {
  const link = { left: 80, top: 200, right: 180, bottom: 224 };
  const photo = { left: 145, top: 180, right: 350, bottom: 400 };
  assert.deepEqual(intersectRectangles(link, photo), { left: 145, top: 200, right: 180, bottom: 224, width: 35, height: 24 });
  const clipped = intersectRectangles(photo, { left: 160, top: 0, right: 300, bottom: 500 });
  assert.equal(intersectRectangles(link, clipped).left, 160, 'off-stage photo pixels do not recolor text');
  assert.equal(intersectRectangles(link, { left: 180, top: 0, right: 250, bottom: 500 }), null);
});

test('source mapping uses the painted photo, including contain letterboxing and cover crop', () => {
  const rect = { left: 10, top: 20, width: 200, height: 200 };
  assert.deepEqual(imagePaintBounds(rect, 400, 200, 'contain'), { left: 10, top: 70, right: 210, bottom: 170, width: 200, height: 100 });
  assert.deepEqual(imagePaintBounds(rect, 400, 200, 'cover'), { left: -90, top: 20, right: 310, bottom: 220, width: 400, height: 200 });
});

test('the whole image chooses one pure black or white ink', () => {
  assert.equal(sourceImageInk(new Uint8ClampedArray([0, 0, 0, 255])), '#ffffff');
  assert.equal(sourceImageInk(new Uint8ClampedArray([255, 255, 255, 255])), '#000000');
  const mixed = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(sourceImageInk(mixed), '#000000');
  const transparent = new Uint8ClampedArray([0, 0, 0, 0]);
  assert.equal(sourceImageInk(transparent), '#000000');
});

test('an interior image replaces the page ink rather than painting over it', () => {
  const tiles = navigationInkTiles({ width: 120, height: 24 }, [{ ink: '#000000', x: 40, y: 6, width: 40, height: 12 }]);
  assert.equal(tiles.length, 5);
  assert.deepEqual(tiles.find(tile => tile.ink === '#000000'), { ink: '#000000', x: 40, y: 6, width: 40, height: 12 });
  for (let first = 0; first < tiles.length; first++) {
    for (let second = first + 1; second < tiles.length; second++) {
      const bounds = tile => ({ left: tile.x, top: tile.y, right: tile.x + tile.width, bottom: tile.y + tile.height });
      assert.equal(intersectRectangles(bounds(tiles[first]), bounds(tiles[second])), null, 'no second fill sits behind a glyph edge');
    }
  }
  assert.equal(tiles.reduce((area, tile) => area + tile.width * tile.height, 0), 120 * 24);
});

test('fractional and overlapping photo regions retain precise boundaries and front-to-back ink order', () => {
  const rect = { width: 100, height: 24 };
  const cases = [
    [],
    [{ ink: '#000000', x: 65.375, y: 3.125, width: 34.625, height: 17.75 }],
    [{ ink: '#ffffff', x: 35.25, y: 10.5, width: 45.5, height: 13.5 }, { ink: '#000000', x: 20.125, y: 2.25, width: 75.5, height: 19.5 }],
    [{ ink: '#000000', x: -10, y: -5, width: 130, height: 40 }]
  ];
  const contains = (tile, x, y) => x >= tile.x && x < tile.x + tile.width && y >= tile.y && y < tile.y + tile.height;
  for (const zones of cases) {
    const tiles = navigationInkTiles(rect, zones);
    assert.ok(Math.abs(tiles.reduce((area, tile) => area + tile.width * tile.height, 0) - rect.width * rect.height) < .000001);
    for (let y = .125; y < rect.height; y += .5) {
      for (let x = .125; x < rect.width; x += .5) {
        const covering = tiles.filter(tile => contains(tile, x, y));
        assert.equal(covering.length, 1, 'every point has exactly one paint, with no gaps or overlaps');
        assert.equal(covering[0].ink, zones.find(zone => contains(zone, x, y))?.ink || 'var(--page-text)');
      }
    }
  }
});

test('navigation updates continuously without loading paint images, and shares one cached ink per source', async () => {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const { document } = window;
  document.body.innerHTML = '<div class="serif-site" style="--page-text:#eceaf2;background:#17171b"><nav class="serif-navigation-desktop"><a href="/resume.pdf">Resume</a><a href="https://example.com">LinkedIn</a></nav><main><div data-art-root><div class="art-stage" style="overflow:hidden"><img src="https://portfolio.example/photo.webp" width="200" height="400"></div></div></main></div>';
  const nav = document.querySelector('nav'), links = [...nav.querySelectorAll('a')], image = document.querySelector('img'), stage = document.querySelector('.art-stage');
  const frames = new Map(); let id = 0, imageLeft = 145, imageTop = 0, samples = 0;
  window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  window.cancelAnimationFrame = frame => frames.delete(frame);
  window.matchMedia = () => Object.assign(new window.EventTarget(), { matches: true });
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  nav.getBoundingClientRect = () => rect(80, 160, 112, 112);
  links[0].getBoundingClientRect = () => rect(80, 160, 100, 24);
  links[1].getBoundingClientRect = () => rect(80, 240, 100, 24);
  image.getBoundingClientRect = () => rect(imageLeft, imageTop, 200, 400);
  stage.getBoundingClientRect = () => rect(100, 0, 300, 500);
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 200 }, naturalHeight: { value: 400 }, currentSrc: { get: () => image.src } });
  let pixels = new Uint8ClampedArray(96 * 96 * 4).fill(255);
  for (let index = 0; index < 96 * 48 * 4; index += 4) pixels.fill(0, index, index + 3);
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, getImageData() { samples++; return { data: pixels }; } });
  const flush = async () => {
    await Promise.resolve();
    const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach(callback => callback(0));
    await Promise.resolve();
  };
  const paint = link => ({ layers: link.style.getPropertyValue('--nav-ink-layers'), positions: link.style.getPropertyValue('--nav-ink-positions'), sizes: link.style.getPropertyValue('--nav-ink-sizes') });
  const darkLayers = 'linear-gradient(var(--page-text), var(--page-text)), linear-gradient(#000000, #000000)';
  const lightLayers = 'linear-gradient(var(--page-text), var(--page-text)), linear-gradient(#ffffff, #ffffff)';
  const release = mountNavigationContrast(nav);
  try {
    document.dispatchEvent(new window.Event('scroll'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 1, 'one frame handles repeated input');
    await flush();
    for (const link of links) {
      assert.ok(link.hasAttribute('data-nav-image-overlap'));
      assert.deepEqual(paint(link), { layers: darkLayers, positions: '0px 0px, 65px 0px', sizes: '65px 24px, 35px 24px' });
    }
    assert.equal(samples, 1, 'different lines share the image-wide cached choice');
    imageTop = 172;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    assert.deepEqual(paint(links[0]), {
      layers: 'linear-gradient(var(--page-text), var(--page-text)), linear-gradient(var(--page-text), var(--page-text)), linear-gradient(#000000, #000000)',
      positions: '0px 0px, 0px 12px, 65px 12px', sizes: '100px 12px, 65px 12px, 35px 12px'
    }, 'letters and underline share the same vertical photo boundary without an overlapping base');
    imageTop = -100;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    for (const link of links) assert.equal(paint(link).layers, darkLayers);
    assert.equal(samples, 1, 'scrolling from a dark region to a light region does not resample the image');
    for (let step = 0; step < 30; step++) {
      imageLeft = 145 + step / 8;
      document.dispatchEvent(new window.Event('scroll')); await flush();
      for (const link of links) {
        const current = paint(link);
        assert.equal(current.layers, darkLayers);
        assert.equal(current.positions, `0px 0px, ${imageLeft - 80}px 0px`, 'the next frame immediately paints the latest geometry');
        assert.doesNotMatch(current.layers, /url\(/, 'there is no asynchronous image decoding between frames');
      }
    }
    imageLeft = 145;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    const beforeTheme = links.map(paint);
    document.querySelector('.serif-site').style.setProperty('--page-text', '#211b2b');
    document.dispatchEvent(new window.Event('portfolio:theme-change')); await flush();
    assert.deepEqual(links.map(paint), beforeTheme, 'off-image paint follows the page variable without regenerating an image');
    assert.equal(samples, 1, 'continuous scrolling and theme changes retain the cached image ink');
    pixels = new Uint8ClampedArray(96 * 96 * 4);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    image.src = 'https://portfolio.example/dark-photo.webp';
    image.dispatchEvent(new window.Event('load'));
    await flush();
    for (const link of links) assert.equal(paint(link).layers, lightLayers);
    assert.equal(samples, 2, 'a replacement source receives a new image-wide choice');
    await flush();
    assert.equal(frames.size, 0, 'idle navigation has no continuing frame loop');
    imageLeft = 400;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    assert.ok(links.every(link => !link.hasAttribute('data-nav-image-overlap')));
    assert.ok(links.every(link => Object.values(paint(link)).every(value => !value)));
    release();
    window.dispatchEvent(new window.Event('resize'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 0);
  } finally { release(); await window.happyDOM.close(); }
});

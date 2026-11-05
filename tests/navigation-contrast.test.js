import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { imagePaintBounds, intersectRectangles, sourceRegionInk, mountNavigationContrast } from '../src/scripts/navigation-contrast.js';

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

test('white paper and dark artwork choose opposite ink from the local source region', () => {
  const pixels = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(sourceRegionInk(pixels, 4, 1, { left: 0, top: 0, right: .5, bottom: 1 }), '#eeebf3');
  assert.equal(sourceRegionInk(pixels, 4, 1, { left: .5, top: 0, right: 1, bottom: 1 }), '#211b2b');
  const transparent = new Uint8ClampedArray([0, 0, 0, 0]);
  assert.equal(sourceRegionInk(transparent, 1, 1, { left: 0, top: 0, right: 1, bottom: 1 }, [255, 255, 255]), '#211b2b');
});

test('desktop overlap updates are coalesced, clear after scrolling away, and stop after cleanup', async () => {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const { document } = window;
  document.body.innerHTML = '<div class="serif-site" style="background:#17171b"><nav class="serif-navigation-desktop"><a href="/">Resume</a></nav><main><div data-art-root><div class="art-stage" style="overflow:hidden"><img src="https://portfolio.example/photo.webp" width="200" height="200"></div></div></main></div>';
  const nav = document.querySelector('nav'), link = nav.querySelector('a'), image = document.querySelector('img'), stage = document.querySelector('.art-stage');
  const frames = new Map(); let id = 0, imageLeft = 145;
  window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  window.cancelAnimationFrame = frame => frames.delete(frame);
  window.matchMedia = () => Object.assign(new window.EventTarget(), { matches: true });
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  nav.getBoundingClientRect = () => rect(80, 200, 112, 164);
  link.getBoundingClientRect = () => rect(80, 200, 100, 24);
  image.getBoundingClientRect = () => rect(imageLeft, 180, 200, 200);
  stage.getBoundingClientRect = () => rect(100, 0, 300, 500);
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 200 }, naturalHeight: { value: 200 } });
  const pixels = new Uint8ClampedArray(96 * 96 * 4).fill(255);
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {}, getImageData: () => ({ data: pixels }) });
  const flush = async () => {
    await Promise.resolve();
    const callbacks = [...frames.values()]; frames.clear();
    callbacks.forEach(callback => callback(0));
    await Promise.resolve();
  };
  const release = mountNavigationContrast(nav);
  try {
    document.dispatchEvent(new window.Event('scroll'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 1, 'one frame handles repeated input');
    await flush();
    assert.ok(link.hasAttribute('data-nav-image-overlap'));
    assert.match(link.style.getPropertyValue('--nav-image-layers'), /#211b2b/);
    assert.equal(link.style.getPropertyValue('--nav-image-positions'), '65px 0px, 0 0');
    assert.equal(link.style.getPropertyValue('--nav-image-sizes'), '35px 24px, 100% 100%');
    await flush();
    assert.equal(frames.size, 0, 'idle navigation has no continuing frame loop');
    imageLeft = 400;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    assert.equal(link.hasAttribute('data-nav-image-overlap'), false);
    release();
    window.dispatchEvent(new window.Event('resize'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 0);
  } finally { release(); await window.happyDOM.close(); }
});

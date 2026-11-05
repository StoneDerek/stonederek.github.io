import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { imagePaintBounds, intersectRectangles, sourceImageInk, mountNavigationContrast } from '../src/scripts/navigation-contrast.js';

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

test('navigation lines share image ink across source regions and scrolling, and recompute only for a new source', async () => {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const { document } = window;
  document.body.innerHTML = '<div class="serif-site" style="background:#17171b"><nav class="serif-navigation-desktop"><a href="/resume.pdf">Resume</a><a href="https://example.com">LinkedIn</a></nav><main><div data-art-root><div class="art-stage" style="overflow:hidden"><img src="https://portfolio.example/photo.webp" width="200" height="400"></div></div></main></div>';
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
  const release = mountNavigationContrast(nav);
  try {
    document.dispatchEvent(new window.Event('scroll'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 1, 'one frame handles repeated input');
    await flush();
    for (const link of links) {
      assert.ok(link.hasAttribute('data-nav-image-overlap'));
      assert.match(link.style.getPropertyValue('--nav-image-layers'), /linear-gradient\(#000000, #000000\)/);
      assert.equal(link.style.getPropertyValue('--nav-image-positions'), '65px 0px, 0 0');
      assert.equal(link.style.getPropertyValue('--nav-image-sizes'), '35px 24px, 100% 100%');
    }
    assert.equal(samples, 1, 'different lines share the image-wide cached choice');
    imageTop = -100;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    for (const link of links) assert.match(link.style.getPropertyValue('--nav-image-layers'), /linear-gradient\(#000000, #000000\)/);
    assert.equal(samples, 1, 'scrolling from a dark region to a light region does not resample the image');
    pixels = new Uint8ClampedArray(96 * 96 * 4);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    image.src = 'https://portfolio.example/dark-photo.webp';
    image.dispatchEvent(new window.Event('load'));
    await flush();
    for (const link of links) assert.match(link.style.getPropertyValue('--nav-image-layers'), /linear-gradient\(#ffffff, #ffffff\)/);
    assert.equal(samples, 2, 'a replacement source receives a new image-wide choice');
    await flush();
    assert.equal(frames.size, 0, 'idle navigation has no continuing frame loop');
    imageLeft = 400;
    document.dispatchEvent(new window.Event('scroll')); await flush();
    assert.ok(links.every(link => !link.hasAttribute('data-nav-image-overlap')));
    release();
    window.dispatchEvent(new window.Event('resize'));
    document.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames.size, 0);
  } finally { release(); await window.happyDOM.close(); }
});

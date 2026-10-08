import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGalleryImages } from '../src/scripts/section-assets.js';

function gallery() {
  const original = globalThis.Image;
  const requests = [];
  globalThis.Image = class {
    constructor() { requests.push(this); }
    decode() { return Promise.resolve(); }
  };
  const image = (src, thumbnail) => ({
    getAttribute: () => src,
    closest: selector => selector === '[data-slide]'
      ? thumbnail === undefined ? {} : null
      : thumbnail === undefined ? null : { dataset: { thumbnail: String(thumbnail) } }
  });
  const doc = {
    getElementById: () => ({ textContent: JSON.stringify([{ slug: 'first' }, { slug: 'second' }]) }),
    querySelectorAll: () => [image('/cover.webp'), image('/first-thumb.webp', 0), image('/second-thumb.webp', 1)]
  };
  return { doc, requests, restore() { if (original === undefined) delete globalThis.Image; else globalThis.Image = original; } };
}

test('a stalled neighboring thumbnail cannot delay the new gallery route', async () => {
  const g = gallery(), controller = new AbortController();
  try {
    let ready = false;
    const waiting = prepareGalleryImages(g.doc, new URL('https://example.com/projects/'), controller.signal).then(() => { ready = true; });
    assert.equal(g.requests.length, 3, 'all thumbnails still warm in parallel');
    g.requests[0].onload();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ready, false, 'the centered thumbnail is still part of the incoming snapshot');
    g.requests[1].onload();
    await waiting;
    assert.equal(ready, true);
    assert.equal(typeof g.requests[2].onload, 'function', 'the neighboring thumbnail is still pending');
    controller.abort();
    assert.equal(g.requests[2].src, '', 'abandoning the route cancels its remaining request');
  } finally { controller.abort(); g.restore(); }
});

test('a direct project route waits for its own centered thumbnail', async () => {
  const g = gallery(), controller = new AbortController();
  try {
    const waiting = prepareGalleryImages(g.doc, new URL('https://example.com/projects/#project=second'), controller.signal);
    g.requests[0].onload(); g.requests[2].onload();
    await waiting;
    assert.equal(typeof g.requests[1].onload, 'function');
  } finally { controller.abort(); g.restore(); }
});

test('cancelling image preparation releases even a stalled cover', async () => {
  const g = gallery(), controller = new AbortController();
  try {
    const waiting = prepareGalleryImages(g.doc, new URL('https://example.com/projects/'), controller.signal);
    controller.abort(); await waiting;
    assert.ok(g.requests.every(image => image.onload === null && image.onerror === null && image.src === ''));
  } finally { controller.abort(); g.restore(); }
});

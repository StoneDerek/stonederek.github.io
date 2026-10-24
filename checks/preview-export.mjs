import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { Window } from 'happy-dom';
import sharp from 'sharp';

const html = await readFile(new URL('../portfolio-preview.html', import.meta.url), 'utf8');

test('the exported page contains visible portfolio content before scripts run', async () => {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    window.document.write(html);
    const doc = window.document;
    assert.equal(doc.querySelector('meta[name="color-scheme"]').content, 'only light');
    assert.equal(doc.documentElement.hasAttribute('data-appearance-enabled'), false);
    assert.equal(doc.documentElement.dataset.theme, 'light');
    const styles = [...doc.querySelectorAll('style')].map(node => node.textContent).join('\n');
    assert.ok(styles.includes('data-appearance-enabled'), 'dark CSS is gated behind an explicit opt-in');
    assert.equal(doc.querySelectorAll('iframe').length, 0);
    assert.equal(doc.querySelectorAll('#portfolio').length, 1);
    assert.ok(doc.querySelector('[data-slide="0"] h1').textContent.trim());
    assert.equal(doc.querySelector('[data-slide="0"]').getAttribute('aria-hidden'), 'false');
    assert.equal(doc.querySelectorAll('[data-slide]').length, 8);
    for (const image of doc.querySelectorAll('img')) assert.match(image.getAttribute('src'), /^data:image\//);
    assert.equal(doc.querySelectorAll('script[src], link[rel="stylesheet"]').length, 0);
    for (const script of doc.scripts) {
      if (script.type === 'application/json') JSON.parse(script.textContent);
      else new Script(script.textContent);
    }
    assert.ok(Buffer.byteLength(html) < 4 * 1024 * 1024, 'keep the preview small enough for attachment viewers');
  } finally { await window.happyDOM.close(); }
});

test('all five Art photos are self-contained preview copies with their original aspect ratio', async () => {
  const data = html.match(/<script\b[^>]*\bid="portfolio-data"[^>]*>([\s\S]*?)<\/script>/);
  const panels = JSON.parse(data[1]);
  const art = panels.find(project => project.slug === 'art');
  const photos = art.caseStudy.sections.flatMap(section => section.media || []);
  assert.equal(photos.length, 5);
  for (const photo of photos) {
    assert.match(photo.src, /^data:image\/webp;base64,/);
    const bytes = Buffer.from(photo.src.split(',')[1], 'base64');
    const info = await sharp(bytes).metadata();
    assert.ok(info.width <= 1440 && info.height <= 1080);
    assert.equal(info.width / info.height, photo.width / photo.height);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { Window } from 'happy-dom';
import sharp from 'sharp';

const html = await readFile(new URL('../portfolio-preview.html', import.meta.url), 'utf8');
const rawPayload = html.match(/<script\b[^>]*\bid="preview-payload"[^>]*>([\s\S]*?)<\/script>/)[1];
const payload = JSON.parse(rawPayload);
const expand = page => {
  let source = page;
  for (const [token, value] of Object.entries(payload.assets)) source = source.replaceAll(token, () => value);
  return source;
};
const options = { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true };

async function inspect(source, run) {
  const window = new Window({ url: 'https://preview.invalid/portfolio-preview.html', settings: options });
  try { window.document.write(source); await run(window.document, window); }
  finally { await window.happyDOM.close(); }
}

test('the exported page has a visible native Home before scripts run and all five local pages', async () => {
  await inspect(html, async doc => {
    assert.equal(doc.querySelector('meta[name="color-scheme"]').content, 'only light');
    assert.equal(doc.documentElement.hasAttribute('data-appearance-enabled'), false);
    assert.equal(doc.documentElement.dataset.theme, 'light');
    assert.ok([...doc.querySelectorAll('style')].some(node => node.textContent.includes('data-appearance-enabled')));
    assert.equal(doc.querySelectorAll('iframe').length, 0);
    assert.equal(doc.querySelectorAll('.serif-site[data-page="home"]').length, 1);
    assert.equal(doc.querySelector('#home-title').textContent, 'Derek Stone');
    assert.equal(doc.querySelector('#portfolio'), null);
    for (const image of doc.querySelectorAll('img[src]')) assert.match(image.getAttribute('src'), /^data:image\//);
    assert.equal(doc.querySelectorAll('script[src], link[rel="stylesheet"]').length, 0);
    assert.deepEqual(Object.keys(payload.pages), ['home', 'about', 'projects', 'art', 'resume']);
    assert.ok(Buffer.byteLength(html) < 4 * 1024 * 1024, 'keep the complete preview within attachment-viewer limits');
  });
});

test('every embedded native page has self-contained images/styles and parseable scripts/data', async () => {
  for (const [route, source] of Object.entries(payload.pages)) {
    const expanded = expand(source);
    assert.doesNotMatch(expanded, /__PORTFOLIO_(?:ASSET|RESOURCE)_\d+__/);
    await inspect(expanded, doc => {
      assert.equal(doc.querySelectorAll('iframe, script[src], link[rel="stylesheet"]').length, 0, route);
      for (const image of doc.querySelectorAll('img[src]')) assert.match(image.getAttribute('src'), /^data:image\//, route);
      for (const script of doc.scripts) {
        if (script.type === 'application/json') JSON.parse(script.textContent);
        else new Script(script.textContent, { filename: `exported-${route}.js` });
      }
      if (route === 'projects') {
        assert.equal(doc.querySelectorAll('[data-work-project]').length, 3);
        assert.equal(doc.querySelectorAll('[data-work-root]').length, 1);
      }
      if (route === 'art') assert.equal(doc.querySelectorAll('#portfolio').length, 1);
    });
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (script[1].includes('application/json')) JSON.parse(script[2]);
    else new Script(script[2], { filename: 'complete-preview.js' });
  }
});

test('all five Art photos remain self-contained and retain their original aspect ratios', async () => {
  await inspect(expand(payload.pages.art), async doc => {
    const panels = JSON.parse(doc.querySelector('#portfolio-data').textContent);
    const art = panels.find(project => project.slug === 'art');
    const photos = art.caseStudy.sections.flatMap(section => section.media || []);
    assert.equal(photos.length, 5);
    for (const photo of photos) {
      assert.match(photo.src, /^data:image\/webp;base64,/);
      const info = await sharp(Buffer.from(photo.src.split(',')[1], 'base64')).metadata();
      assert.ok(info.width <= 1440 && info.height <= 1080);
      assert.equal(info.width / info.height, photo.width / photo.height);
    }
  });
});

test('the preview bridge switches native pages, keeps Work history state, and preserves About anchors', async () => {
  const window = new Window({ url: 'https://preview.invalid/portfolio-preview.html', settings: options });
  const revoked = [];
  const scrollTargets = [];
  try {
    window.document.write(html);
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = function() { scrollTargets.push(this.id); };
    window.URL.createObjectURL = () => 'blob:https://preview.invalid/resume';
    window.URL.revokeObjectURL = value => revoked.push(value);
    const code = window.document.querySelector('script[data-preview-bridge]').textContent;
    window.eval(code);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    const flush = async () => {
      for (let i = 0; i < 6; i++) await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    await flush();
    const follow = address => window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address, replace: false, state: null });
    follow('/about/#interests'); await flush();
    assert.ok(window.document.querySelector('.serif-site[data-page="about"]'));
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/about/#interests');
    assert.ok(scrollTargets.includes('interests'));
    follow('/projects/'); await flush();
    assert.ok(window.document.querySelector('[data-work-root]'));
    const received = [];
    window.addEventListener('portfolio:preview-navigate', event => received.push(event.detail.address));
    const state = { work: { view: 'article', gridY: 432, slug: 'rag-chatbot' }, custom: 'kept' };
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/projects/#project=rag-chatbot', replace: false, state });
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/projects/#project=rag-chatbot');
    assert.deepEqual(window.history.state, state);
    assert.equal(window.location.hash, '#projects?project=rag-chatbot');
    window.history.back(); await flush();
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/projects/');
    assert.deepEqual(received, ['/projects/']);
    window.history.forward(); await flush();
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/projects/#project=rag-chatbot');
    assert.deepEqual(window.history.state, state);
    follow('/art/#links'); await flush();
    assert.ok(window.document.querySelector('#portfolio'));
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#links');
    follow('/resume/'); await flush();
    assert.ok(window.document.querySelector('.serif-site[data-page="resume"]'));
    assert.equal(window.document.querySelector('[data-resume-pdf]').href, 'blob:https://preview.invalid/resume');
    assert.deepEqual(revoked, [], 'local page switches do not fake pagehide and revoke the PDF');
  } finally { await window.happyDOM.close(); }
});

test('compiled preview apps retain Art on its own route and open real Work articles after page switching', async () => {
  const window = new Window({ url: 'https://preview.invalid/portfolio-preview.html', settings: options });
  const frames = new Map();
  let frameId = 0, scrollY = 0;
  try {
    window.matchMedia = query => Object.assign(new window.EventTarget(), { matches: query.includes('reduced-motion') });
    window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
    window.cancelAnimationFrame = id => frames.delete(id);
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    window.scrollTo = (left, top) => { scrollY = typeof left === 'object' ? left.top : top; };
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLElement.prototype.getAnimations = () => [];
    window.HTMLElement.prototype.getBoundingClientRect = function() {
      const width = this.matches('.thumbnail') ? 88 : this.matches('.caption-word, [data-title-metrics]') ? this.textContent.length * 8 : 390;
      return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: 64, width, height: 64 };
    };
    Object.defineProperties(window.HTMLElement.prototype, {
      clientWidth: { configurable: true, get() { return this.matches('.thumbnail') ? 88 : 390; } },
      clientHeight: { configurable: true, get() { return 844; } }
    });
    window.HTMLCanvasElement.prototype.getContext = function() {
      return this.classList.contains('laser-canvas') ? null : { measureText: text => ({ width: text.length * 8 }) };
    };
    window.CSS.supports = () => false;
    window.document.write(html);
    Object.defineProperty(window.document, 'readyState', { configurable: true, value: 'complete' });
    const executePage = () => {
      for (const script of [...window.document.scripts]) {
        if (script.type === 'application/json') continue;
        const descriptor = Object.getOwnPropertyDescriptor(window.document, 'currentScript');
        Object.defineProperty(window.document, 'currentScript', { configurable: true, value: script });
        try { window.eval(script.textContent); }
        finally {
          if (descriptor) Object.defineProperty(window.document, 'currentScript', descriptor);
          else delete window.document.currentScript;
        }
      }
    };
    // HappyDOM deliberately disables automatic script loading in this fixture.
    // Execute the actual compiled inline scripts at the bridge's mount boundary.
    window.addEventListener('portfolio:preview-mounted', executePage);
    executePage();
    const flush = async () => {
      for (let i = 0; i < 24; i++) {
        await Promise.resolve();
        const callbacks = [...frames.values()]; frames.clear();
        for (const callback of callbacks) callback(i * 16);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    };
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/art/', replace: false, state: null });
    await flush();
    assert.ok(window.document.querySelector('#portfolio'), 'the Art gallery remains mounted after its app initializes');
    assert.equal(window.document.querySelector('[data-work-root]'), null);
    assert.match(window.__PORTFOLIO_PREVIEW_ADDRESS__, /^\/art\//);
    const artRoot = window.document.querySelector('#portfolio');
    const panels = JSON.parse(window.document.querySelector('#portfolio-data').textContent);
    assert.equal(panels[Number(artRoot.dataset.panel)].slug, 'art');
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/projects/', replace: false, state: null });
    await flush();
    const card = window.document.querySelector('[data-work-project="rag-chatbot"]');
    assert.match(card.href, /portfolio-preview\.html#projects\?project=rag-chatbot$/);
    scrollY = 432;
    card.click(); await flush();
    assert.equal(window.document.querySelector('[data-work-grid]').hidden, true);
    assert.equal(window.document.querySelector('[data-work-article]').hidden, false);
    assert.equal(window.document.querySelector('[data-detail-title]').textContent, 'RAG Chatbot for Academic Advising');
    assert.ok(window.history.state.portfolioWork.gridId, 'rewritten card click retains the real controller\'s grid origin');
    const articleAddress = window.location.href;
    const articleHistory = JSON.stringify(window.history.state);
    window.document.querySelector('.serif-skip-link').click(); await flush();
    assert.equal(window.location.href, articleAddress, 'skip-to-content preserves the article URL');
    assert.equal(JSON.stringify(window.history.state), articleHistory, 'skip-to-content preserves history state');
    assert.equal(window.document.activeElement, window.document.querySelector('[data-detail-title]'));
    window.history.back(); await flush();
    assert.equal(window.document.querySelector('[data-work-grid]').hidden, false);
    assert.equal(scrollY, 432);
    window.history.forward(); await flush();
    assert.equal(window.document.querySelector('[data-work-article]').hidden, false);
    assert.ok(window.history.state.portfolioWork.gridId);
    window.document.querySelector('[data-work-close]').click(); await flush();
    assert.equal(window.document.querySelector('[data-work-grid]').hidden, false);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/projects/');
    assert.equal(scrollY, 432, 'Close after Forward returns to the original grid reading position');
    // External hash navigation enters through the bridge, unlike controller-owned
    // same-page writes, which already render before updating the preview address.
    window.location.hash = '#projects?links';
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));
    await flush();
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#links');
    assert.ok(window.document.querySelector('#portfolio'));
    assert.equal(Number(window.document.querySelector('#portfolio').dataset.panel), panels.length);
  } finally {
    window.dispatchEvent(new window.Event('portfolio:preview-unmount'));
    await window.happyDOM.close();
  }
});

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

test('the export has a useful Home before scripts run, all native pages and the legacy PDF redirect', async () => {
  await inspect(html, async doc => {
    assert.equal(doc.querySelector('meta[name="color-scheme"]').content, 'light dark');
    assert.equal(doc.documentElement.hasAttribute('data-appearance-enabled'), true);
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
      if (route === 'art') {
        assert.equal(doc.querySelectorAll('[data-art-root]').length, 1);
        assert.equal(doc.querySelectorAll('[data-art-item]').length, 5);
        assert.equal(doc.querySelectorAll('[data-art-select]').length, 5);
        assert.equal(doc.querySelector('#portfolio, [data-work-project]'), null);
        assert.equal(doc.querySelector('[data-art-title]').textContent, 'Untitled #1');
        assert.equal(doc.querySelector('.art-caption, [data-art-step], [data-art-count]'), null);
        assert.ok([...doc.querySelectorAll('[data-art-select]')].every(button => !button.textContent.trim()));
      }
    });
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (script[1].includes('application/json')) JSON.parse(script[2]);
    else new Script(script[2], { filename: 'complete-preview.js' });
  }
});

test('all five Art photos remain self-contained and retain their original aspect ratios', async () => {
  await inspect(expand(payload.pages.art), async doc => {
    const art = JSON.parse(doc.querySelector('#art-data').textContent);
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

test('the preview bridge keeps native navigation/history, About anchors and immediate embedded PDF access', async () => {
  const window = new Window({ url: 'https://preview.invalid/portfolio-preview.html', settings: options });
  const revoked = [];
  const redirects = [];
  const scrollTargets = [];
  try {
    window.document.write(html);
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = function() { scrollTargets.push(this.id); };
    window.URL.createObjectURL = () => 'blob:https://preview.invalid/resume';
    window.URL.revokeObjectURL = value => revoked.push(value);
    window.location.replace = value => redirects.push(value);
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
    assert.ok(window.document.querySelector('[data-art-root]'));
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#links');
    const pdfLinks = [...window.document.querySelectorAll('[data-resume-link]')];
    assert.ok(pdfLinks.length > 0);
    for (const link of pdfLinks) assert.equal(link.href, 'blob:https://preview.invalid/resume');
    follow('/resume/'); await flush();
    assert.deepEqual(redirects, ['blob:https://preview.invalid/resume']);
    assert.equal(window.document.querySelector('.serif-site[data-page="resume"]'), null);
    assert.deepEqual(revoked, [], 'local page switches do not fake pagehide and revoke the PDF');
  } finally { await window.happyDOM.close(); }
});

test('compiled apps preserve theme preferences, individual Art selection/history and real Work articles across pages', async () => {
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
    const captures = new WeakMap();
    window.HTMLElement.prototype.setPointerCapture = function(id) { captures.set(this, id); };
    window.HTMLElement.prototype.hasPointerCapture = function(id) { return captures.get(this) === id; };
    window.HTMLElement.prototype.releasePointerCapture = function() { captures.delete(this); };
    window.HTMLElement.prototype.getBoundingClientRect = function() {
      const artThumb = this.hasAttribute('data-art-select');
      const width = artThumb ? 80 : this.hasAttribute('data-art-item') ? 351 : this.matches('.thumbnail') ? 88 : this.matches('.caption-word, [data-title-metrics]') ? this.textContent.length * 8 : 390;
      const left = artThumb ? 155 + Number(this.dataset.artSelect) * 88 - (window.document.querySelector('[data-art-rail]')?.scrollLeft || 0) : 0;
      return { x: left, y: 0, left, top: 0, right: left + width, bottom: 64, width, height: 64 };
    };
    Object.defineProperties(window.HTMLElement.prototype, {
      clientWidth: { configurable: true, get() { return this.matches('.thumbnail') ? 88 : 390; } },
      clientHeight: { configurable: true, get() { return 844; } },
      offsetWidth: { configurable: true, get() { return this.hasAttribute('data-art-select') ? 80 : this.hasAttribute('data-art-item') ? 351 : 390; } },
      offsetLeft: { configurable: true, get() { return this.hasAttribute('data-art-select') ? Number(this.dataset.artSelect) * 88 : 0; } }
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
    const assertTheme = (theme, preference) => {
      assert.equal(window.document.documentElement.dataset.theme, theme);
      assert.equal(window.document.documentElement.dataset.themePreference, preference);
      const switches = [...window.document.querySelectorAll('[data-theme-switch]')];
      assert.equal(switches.length, 1);
      for (const toggle of switches) {
        assert.equal(toggle.closest('[data-theme-control]').hidden, false);
        assert.equal(toggle.getAttribute('aria-checked'), String(theme === 'dark'));
        assert.equal(toggle.querySelector('[data-theme-action]').textContent, theme === 'dark' ? 'Light mode' : 'Dark mode');
      }
    };
    assertTheme('light', 'system');
    const themeEvents = [];
    window.document.addEventListener('portfolio:theme-change', event => themeEvents.push(event.detail.resolved));
    window.document.querySelector('.serif-footer [data-theme-switch]').click();
    assertTheme('dark', 'dark');
    assert.equal(window.localStorage.getItem('derek-stone-theme'), 'dark');
    assert.deepEqual(themeEvents, ['dark']);
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/art/#artwork=02', replace: false, state: null });
    await flush();
    assertTheme('dark', 'dark');
    const artRoot = window.document.querySelector('[data-art-root]');
    const stage = artRoot.querySelector('[data-art-stage]');
    assert.ok(artRoot, 'the inline Art gallery mounts without the old portfolio controller');
    assert.equal(window.document.querySelector('#portfolio'), null);
    assert.equal(window.document.querySelector('[data-work-root]'), null);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=02');
    const assertArtwork = index => {
      assert.equal(Number(artRoot.dataset.artIndex), index);
      const items = [...artRoot.querySelectorAll('[data-art-item]')];
      assert.equal(items.length, 5);
      assert.ok(items.every(item => !item.hidden));
      assert.deepEqual(items.map(item => item.getAttribute('aria-hidden')), items.map((_, i) => String(i !== index)));
      const current = [...artRoot.querySelectorAll('[data-art-select][aria-current="true"]')];
      assert.equal(current.length, 1);
      assert.equal(Number(current[0].dataset.artSelect), index);
      assert.equal(artRoot.querySelector('[data-art-title]').textContent, `Untitled #${index + 1}`);
      assert.equal(artRoot.querySelector('.art-caption, [data-art-step], [data-art-count]'), null);
      assert.ok([...artRoot.querySelectorAll('[data-art-select]')].every(button => !button.textContent.trim()));
      const details = artRoot.querySelector('[data-art-details]');
      const chapters = [...details.querySelectorAll('.case-study-section')];
      assert.equal(chapters.length, 5);
      assert.deepEqual(chapters.map(chapter => chapter.hidden), chapters.map((_, i) => i !== index));
      assert.deepEqual(chapters.map(chapter => chapter.inert), chapters.map((_, i) => i !== index));
      assert.deepEqual(chapters.map(chapter => chapter.getAttribute('aria-hidden')), chapters.map((_, i) => String(i !== index)));
      assert.ok([...details.querySelectorAll('.case-study-section h2')].every(heading => heading.hidden));
      assert.deepEqual([...details.querySelectorAll('.project-footnote')].filter(note => !note.hidden).map(note => note.id),
        ['project-note-art-1', 'project-note-art-2', 'project-note-art-3']);
      assert.doesNotMatch(details.textContent, /The cover for this section/);
    };
    assertArtwork(1);
    artRoot.querySelector('[data-art-select="2"]').click(); await flush();
    assertArtwork(2);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=03');
    const artAddress = window.location.href;
    const artHistory = JSON.stringify(window.history.state);
    window.document.querySelector('.serif-skip-link').click(); await flush();
    assertArtwork(2);
    assert.equal(window.location.href, artAddress, 'Art skip navigation preserves the selected artwork URL');
    assert.equal(JSON.stringify(window.history.state), artHistory);
    assert.equal(window.document.activeElement, artRoot.querySelector('[data-art-stage]'));
    assert.match(artRoot.querySelector('[data-art-details]').textContent, /depicted in ink using a process called/);
    assert.match(artRoot.querySelector('[data-art-details]').textContent, /Einstein/);
    assert.equal(artRoot.querySelector('[data-art-details] img'), null, 'the overview does not duplicate the gallery images');
    artRoot.querySelector('[data-article-jump="project-note-art-2"]').click(); await flush();
    assert.equal(window.document.activeElement.id, 'project-note-art-2');
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=03', 'a note keeps the selected artwork URL');
    artRoot.querySelector('[data-article-jump="project-ref-art-2"]').click(); await flush();
    assert.equal(window.document.activeElement.id, 'project-ref-art-2');
    const track = artRoot.querySelector('[data-art-track]');
    const translation = () => Number(track.style.transform.match(/translate(?:3d|X)\(\s*([-+e.\d]+)px/)[1]);
    const heldStart = translation();
    const pointer = (type, x) => stage.dispatchEvent(new window.PointerEvent(type, {
      pointerId: 13, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: 150, bubbles: true, cancelable: true
    }));
    pointer('pointerdown', 250); pointer('pointermove', 150); await flush();
    assert.ok(translation() < heldStart && translation() > heldStart - 351, 'the compiled gallery follows a fractional held drag');
    assert.ok(artRoot.querySelector('[data-art-rail]').scrollLeft > 176 && artRoot.querySelector('[data-art-rail]').scrollLeft < 264);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=03', 'held motion preserves the current history destination');
    pointer('pointercancel', 150); await flush(); assertArtwork(2);
    window.history.back(); await flush();
    assertArtwork(1);
    window.history.forward(); await flush();
    assertArtwork(2);
    const key = (value, target = stage) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    key('ArrowRight'); await flush();
    assertArtwork(3);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=04');
    key('End'); await flush();
    assertArtwork(4);
    let historyLength = window.history.length;
    key('ArrowRight'); await flush();
    assertArtwork(4);
    assert.equal(window.history.length, historyLength, 'the gallery stops at its last artwork without adding history');
    artRoot.querySelector('[role="doc-backlink"][data-article-jump="project-ref-art-1"]').click(); await flush();
    assertArtwork(0);
    assert.equal(window.document.activeElement.id, 'project-ref-art-1', 'an endnote return reveals and focuses its artwork reference');
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, '/art/#artwork=01');
    assert.equal(window.history.length, historyLength + 1, 'returning to another artwork adds one destination');
    window.history.back(); await flush();
    assertArtwork(4);
    key('Home'); await flush();
    assertArtwork(0);
    historyLength = window.history.length;
    key('ArrowLeft'); await flush();
    assertArtwork(0);
    assert.equal(window.history.length, historyLength, 'the gallery stops at its first artwork');
    key('ArrowRight'); await flush();
    assertArtwork(1);
    const opener = artRoot.querySelector('[data-art-item="1"] [data-image-open]');
    const viewer = artRoot.querySelector('[data-image-viewer]');
    const viewerAddress = window.__PORTFOLIO_PREVIEW_ADDRESS__;
    opener.focus(); opener.click(); await flush();
    assert.equal(viewer.open, true);
    const fullImage = artRoot.querySelector('[data-image-full]');
    assert.equal(fullImage.src, opener.querySelector('img').src);
    Object.defineProperties(fullImage, { naturalWidth: { value: 1440, configurable: true }, naturalHeight: { value: 1080, configurable: true } });
    fullImage.dispatchEvent(new window.Event('load'));
    const fitted = parseInt(artRoot.querySelector('[data-image-scale]').textContent);
    artRoot.querySelector('[data-image-zoom]').click(); await flush();
    assert.equal(artRoot.querySelector('[data-image-canvas]').hasAttribute('data-zoomed'), true);
    assert.ok(parseInt(artRoot.querySelector('[data-image-scale]').textContent) > fitted);
    const scaleControl = artRoot.querySelector('[data-image-scale]');
    assert.equal(scaleControl.tagName, 'BUTTON');
    scaleControl.click(); await flush();
    assert.equal(scaleControl.textContent, '100%');
    for (let i = 0; i < 8; i++) artRoot.querySelector('[data-image-zoom]').click();
    await flush();
    assert.equal(scaleControl.textContent, '400%');
    key('1', fullImage); await flush();
    assert.equal(scaleControl.textContent, '100%');
    key('ArrowRight', fullImage); await flush();
    assertArtwork(1);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, viewerAddress, 'inspection does not select another artwork or change the URL');
    key('0', fullImage); await flush();
    assert.equal(artRoot.querySelector('[data-image-canvas]').hasAttribute('data-zoomed'), false);
    viewer.dispatchEvent(new window.Event('cancel', { cancelable: true })); await flush();
    assert.equal(viewer.open, false);
    assert.equal(window.document.activeElement, opener);
    assert.equal(window.__PORTFOLIO_PREVIEW_ADDRESS__, viewerAddress);
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/projects/', replace: false, state: null });
    await flush();
    assertTheme('dark', 'dark');
    const card = window.document.querySelector('[data-work-project="rag-chatbot"]');
    assert.match(card.href, /portfolio-preview\.html#projects\?project=rag-chatbot$/);
    scrollY = 432;
    card.click(); await flush();
    assert.equal(window.document.querySelector('[data-work-grid]').hidden, true);
    assert.equal(window.document.querySelector('[data-work-article]').hidden, false);
    assert.equal(window.document.querySelector('[data-detail-title]').textContent, 'RAG Chatbot for Academic Advising');
    const projectArticle = window.document.querySelector('[data-work-article]');
    assert.equal(projectArticle.querySelectorAll('p').length, 1);
    assert.match(projectArticle.querySelector('p').textContent, /^Lorem ipsum dolor sit amet,/);
    assert.equal(projectArticle.querySelector('img, dialog, .case-study-section'), null);
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
    assert.ok(window.document.querySelector('[data-art-root]'));
    assert.equal(window.document.querySelector('[data-art-puzzle]').hidden, false);
    assert.equal(window.document.activeElement, window.document.querySelector('[data-art-puzzle]'));
    assertTheme('dark', 'dark');
    window.document.querySelector('.serif-footer [data-theme-switch]').click();
    assertTheme('light', 'light');
    assert.equal(window.localStorage.getItem('derek-stone-theme'), 'light');
    assert.deepEqual(themeEvents, ['dark', 'light'], 'each toggle has one active theme controller after repeated page mounts');
    for (const legacy of ['project=art', 'slide=art']) {
      window.location.hash = `#art?${legacy}`;
      window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      await flush();
      assert.equal(Number(window.document.querySelector('[data-art-root]').dataset.artIndex), 0);
      assert.equal(window.document.querySelector('[data-art-puzzle]').hidden, true);
    }
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__({ address: '/about/', replace: false, state: null });
    await flush();
    assertTheme('light', 'light');
    assert.equal(window.document.querySelectorAll('main p').length, 1);
    assert.match(window.document.querySelector('main p').textContent, /^Lorem ipsum dolor sit amet,/);
  } finally {
    window.dispatchEvent(new window.Event('portfolio:preview-unmount'));
    await window.happyDOM.close();
  }
});

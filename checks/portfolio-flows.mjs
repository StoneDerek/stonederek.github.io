import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { Script } from 'node:vm';
import { mountPortfolio } from '../src/scripts/carousel.js';

// Exercise production markup and the real controller. This is DOM simulation:
// geometry, time and canvas text metrics are supplied, not browser rendering.
async function scene(address = '/', { reduced = true, width = 390, tiles = false, onMount } = {}) {
  const route = address.split('#')[0];
  const entry = route.includes('/projects') ? 'projects/' : route.includes('/about') ? 'about/' : '';
  const html = await readFile(new URL(`../dist/${entry}index.html`, import.meta.url), 'utf8');
  const window = new Window({ url: `https://stonederek.github.io${address}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  const { document } = window;
  window.innerWidth = width;
  window.innerHeight = 844;
  window.ontouchstart = null;
  document.write(html);
  const root = document.querySelector('#portfolio');
  const startup = document.querySelector('script[data-portfolio-entry]');
  new Script(startup.textContent).runInNewContext({ window, document, URL });
  const startupPending = document.documentElement.hasAttribute('data-portfolio-entry-pending');
  const frames = new Map();
  let clock = 0, nextFrame = 0;
  const preferences = new Map();
  window.matchMedia = query => {
    if (!preferences.has(query)) {
      const media = new window.EventTarget();
      media.matches = query.includes('reduced-motion') && reduced;
      preferences.set(query, media);
    }
    return preferences.get(query);
  };
  window.HTMLCanvasElement.prototype.getContext = function() {
    // Puzzle rendering is covered by its own tests; no canvas renderer here.
    return this.classList.contains('laser-canvas') ? null : { measureText: text => ({ width: text.length * 8 }) };
  };
  const captures = new WeakMap();
  window.HTMLElement.prototype.setPointerCapture = function(id) { captures.set(this, id); };
  window.HTMLElement.prototype.hasPointerCapture = function(id) { return captures.get(this) === id; };
  window.HTMLElement.prototype.releasePointerCapture = function() { captures.delete(this); };
  window.HTMLElement.prototype.getAnimations = () => [];
  window.HTMLElement.prototype.getBoundingClientRect = function() {
    const w = this.matches('[data-image-canvas]') ? parseFloat(this.style.width) || width : this.matches('.thumbnail') ? 88 : this.matches('.caption-word, [data-title-metrics]') ? this.textContent.length * 8 : width;
    const h = this.matches('[data-image-canvas]') ? parseFloat(this.style.height) || 64 : this.matches('.image-viewer-toolbar') ? 44 : 64;
    return { x: 0, y: 0, left: 0, right: w, top: 0, bottom: h, width: w, height: h };
  };
  for (const node of [document.documentElement, root, ...root.querySelectorAll('[data-stage], .thumbnail-rail, [data-project-view]')]) {
    Object.defineProperties(node, { clientWidth: { value: width, configurable: true }, clientHeight: { value: 844, configurable: true } });
  }
  const nativeStyle = window.getComputedStyle.bind(window);
  const style = node => new Proxy(nativeStyle(node), { get(target, key) {
    if (key === 'width' && node.matches('.thumbnail')) return '88px';
    if (key === 'getPropertyValue') return name => name === '--thumb-width' ? '80px' : target.getPropertyValue(name);
    return Reflect.get(target, key);
  } });
  const globals = {
    window, document, Element: window.Element, AbortController: window.AbortController,
    getComputedStyle: style, CSS: { supports: () => tiles }, performance: { now: () => clock },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id)
  };
  const descriptors = Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  Object.entries(globals).forEach(([name, value]) => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }));
  let cleanup;
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const tick = async (milliseconds = 1000) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
      clock += 16;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback(clock));
      await flush();
    }
  };
  const find = selector => { const node = root.querySelector(selector); assert.ok(node, `Missing ${selector}`); return node; };
  const click = selector => {
    const node = find(selector);
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 });
    node.dispatchEvent(event);
    return event;
  };
  const key = (name, selector = '.carousel') => find(selector).dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: name }));
  const pointer = (type, x, selector = '[data-profile-scroll]') => find(selector).dispatchEvent(new window.PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: 200
  }));
  const close = async () => {
    cleanup?.();
    await flush();
    await window.happyDOM.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  };
  try { cleanup = mountPortfolio(); onMount?.({ root, document, startupPending }); await cleanup.entryDone; await flush(); }
  catch (error) { await close(); throw error; }
  return { window, document, root, find, click, key, pointer, tick, flush, close,
    get frames() { return frames.size; },
    get address() { return window.location.pathname + window.location.hash; },
    get panel() { return Number(root.dataset.panel); },
    get article() { return root.dataset.article; },
    get panels() { return JSON.parse(document.querySelector('#portfolio-data').textContent); }
  };
}

test('all direct panel and article URLs mount one persistent portfolio with matching state', async () => {
  const projects = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
  const addresses = [['/', 0, null], ['/about/#interests', 1, null], ['/projects/', 2, null],
    ['/projects/#links', projects.length + 2, null], ['/projects/#project=missing', 2, null],
    ...projects.flatMap((p, i) => [[`/projects/#slide=${p.slug}`, i + 2, null], [`/projects/#project=${p.slug}`, i + 2, i + 2]])];
  for (const [address, panel, article] of addresses) {
    const s = await scene(address);
    try {
      assert.equal(s.panel, panel, address);
      assert.equal(s.find('[data-project-view]').hidden, article === null, address);
      assert.equal(s.document.querySelectorAll('#portfolio').length, 1);
      assert.equal(s.document.querySelector('link[rel="icon"]').getAttribute('href'), '/favicon.svg', address);
      assert.equal(s.find('.menu-name').textContent, 'stonederek.github.io', address);
      assert.equal(s.find('[data-menu-context]').textContent, panel === 0 ? 'Home' : panel === 1 ? 'About' : panel === projects.length + 2 ? 'Links' : article === null ? 'Projects:' : 'Project:', address);
      assert.equal(s.find('[data-menu-title]').textContent, panel < 2 || panel === projects.length + 2 ? '' : projects[panel - 2].galleryTitle || projects[panel - 2].title, address);
      if (panel >= 2 && panel < projects.length + 2 && article === null) {
        const project = projects[panel - 2];
        assert.equal(s.find('[data-title]').textContent, project.galleryTitle || project.title, address);
        assert.equal(s.find('[data-title-method]').textContent, project.galleryMethod || '', address);
        assert.equal(s.find('.caption-link').getAttribute('aria-label'), `View ${project.title}`, address);
      }
      if (panel === projects.length + 2) {
        assert.equal(s.find('[data-menu] > summary').getAttribute('aria-label'), 'Open navigation. Links');
        assert.equal(s.document.title, 'Derek Stone - Links');
      }
      if (article !== null) assert.equal(Number(s.article), article, address);
    } finally { await s.close(); }
  }
});

test('old project links open the same project and replace their previous URL without adding history', async () => {
  for (const [old, current, panel] of [
    ['signal-studies', 'acoustic-drone-detection', 2],
    ['academic-advising', 'rag-chatbot', 3],
    ['soft-machines', 'rag-chatbot', 3],
    ['afterimage', '2d-lightning-simulation', 4]
  ]) {
    for (const article of [false, true]) {
      const s = await scene(`/projects/#${article ? 'project' : 'slide'}=${old}`);
      try {
        assert.equal(s.panel, panel);
        assert.equal(s.article, article ? String(panel) : undefined);
        assert.equal(s.address, !article && panel === 2 ? '/projects/' : `/projects/#${article ? 'project' : 'slide'}=${current}`);
        assert.equal(s.window.history.length, 1);
        assert.equal(s.find('[data-menu-title]').textContent, s.panels[panel].galleryTitle);
      } finally { await s.close(); }
    }
  }
});

test('direct article entry resolves synchronously without a gallery flash or reveal animation', async () => {
  const projects = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
  for (const project of projects) {
    const s = await scene(`/projects/#project=${project.slug}`, {
      reduced: false, tiles: true,
      onMount: ({ root, document, startupPending }) => {
        assert.equal(startupPending, true, 'the head script conceals the default gallery before the controller starts');
        assert.equal(document.documentElement.hasAttribute('data-portfolio-entry-pending'), false);
        assert.equal(root.dataset.ready, 'true');
        assert.equal(root.querySelector('[data-detail-title]').textContent, project.title);
        assert.equal(root.querySelector('[data-menu-title]').textContent, project.galleryTitle || project.title);
        assert.equal(root.querySelector('[data-menu-context]').textContent, 'Project:');
        assert.equal(root.querySelector('[data-project-view]').hidden, false);
        assert.equal(root.querySelector('[data-project-view]').inert, false);
        assert.equal(root.classList.contains('is-project-opening'), false);
        assert.equal(root.querySelectorAll('.project-tile-layer').length, 0);
      }
    });
    try {
      assert.equal(s.article, String(s.panels.findIndex(panel => panel.slug === project.slug)));
    } finally { await s.close(); }
  }
});

test('opening an article from the gallery still animates and returns to its own cover', async () => {
  const s = await scene('/projects/', { reduced: false, tiles: true });
  try {
    const index = s.panels.findIndex(panel => panel.slug === 'art');
    s.click(`[data-menu-project="${index}"]`);
    assert.equal(s.root.classList.contains('is-project-opening'), true);
    assert.equal(s.root.querySelectorAll('.project-tile-layer').length, 1);
    await s.tick();
    assert.equal(s.article, String(index));
    assert.equal(s.find('[data-detail-title]').textContent, 'Art');
    s.click('.back-button');
    await s.tick();
    assert.equal(s.panel, index);
    assert.equal(s.address, '/projects/#slide=art');
  } finally { await s.close(); }
});

test('the early entry guard works before body parsing and releases the fallback on load', async () => {
  const html = await readFile(new URL('../dist/projects/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('data-portfolio-entry') < html.indexOf('<body'));
  const script = html.match(/<script\b[^>]*data-portfolio-entry[^>]*>([\s\S]*?)<\/script>/)[1];
  for (const [address, preview, pending] of [
    ['https://stonederek.github.io/projects/#project=art', undefined, true],
    ['https://stonederek.github.io/portfolio/projects/index.html#slide=art', undefined, true],
    ['https://stonederek.github.io/projects/', undefined, false],
    ['https://stonederek.github.io/about/#interests', undefined, false],
    ['file:///portfolio-preview.html#projects?project=art', '/projects/#project=art', true]
  ]) {
    const window = new Window({ url: address, settings: { disableJavaScriptEvaluation: true } });
    try {
      window.__PORTFOLIO_PREVIEW_ADDRESS__ = preview;
      new Script(script).runInNewContext({ window, document: window.document, URL });
      assert.equal(window.document.querySelector('#portfolio'), null);
      assert.equal(window.document.documentElement.hasAttribute('data-portfolio-entry-pending'), pending, address);
      window.dispatchEvent(new window.Event('load'));
      assert.equal(window.document.documentElement.hasAttribute('data-portfolio-entry-pending'), false);
    } finally { await window.happyDOM.close(); }
  }
});

test('the static favicon stays untouched across gallery, article and Links navigation', async () => {
  const s = await scene();
  const icon = s.document.querySelector('link[rel="icon"]');
  const mutations = [];
  const observer = new s.window.MutationObserver(records => mutations.push(...records));
  observer.observe(icon, { attributes: true });
  try {
    for (let index = 0; index < s.panels.length; index++) s.click(`[data-thumbnail="${index}"]`);
    s.click('.caption-link'); await s.flush();
    s.click('[data-menu-project="2"]'); await s.flush();
    s.click('.back-button'); await s.flush();
    s.key('End'); s.key('Home');
    assert.equal(s.find('[data-menu-context]').textContent, 'Home');
    assert.equal(s.find('[data-menu-title]').textContent, '');
    s.click('[data-menu-about]');
    assert.equal(s.find('[data-menu-context]').textContent, 'About');
    assert.equal(s.find('[data-menu-title]').textContent, '');
    mutations.push(...observer.takeRecords());
    assert.equal(s.document.querySelector('link[rel="icon"]'), icon);
    assert.equal(icon.getAttribute('href'), '/favicon.svg');
    assert.equal(mutations.length, 0, 'navigation must not rewrite the browser tab icon');
  } finally { observer.disconnect(); await s.close(); }
});

test('a held drag and its settling animation update panel state only when selection changes', async () => {
  const s = await scene('/projects/', { reduced: false });
  const mutations = [];
  const observer = new s.window.MutationObserver(records => mutations.push(...records));
  observer.observe(s.root, { attributes: true, attributeFilter: ['data-panel', 'data-panel-kind'] });
  try {
    s.pointer('pointerdown', 330, '.caption-link');
    s.pointer('pointermove', 80, '.caption-link');
    await s.tick(112);
    s.pointer('pointerup', 80, '.caption-link');
    await s.tick();
    mutations.push(...observer.takeRecords());
    assert.equal(s.panel, 3);
    assert.equal(s.find('[data-gallery-track]').style.transform, 'translateX(-1170px)');
    assert.equal(s.find('.caption-link').getAttribute('aria-label'), `View ${s.panels[3].title}`);
    assert.equal(s.find('.project-caption').inert, false);
    assert.equal(s.frames, 0, 'both movement and lift must finish');
    assert.equal(mutations.filter(record => record.attributeName === 'data-panel').length, 1);
    assert.equal(mutations.filter(record => record.attributeName === 'data-panel-kind').length, 0);
  } finally { observer.disconnect(); await s.close(); }
});

test('resizing a settled gallery realigns the rail when thumbnail sizing changes', async () => {
  const s = await scene('/projects/');
  try {
    assert.equal(s.find('.thumbnail-rail').scrollLeft, 176);
    const previousStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = node => new Proxy(previousStyle(node), { get(target, key) {
      return key === 'width' && node.matches('.thumbnail') ? '104px' : Reflect.get(target, key);
    } });
    Object.defineProperty(s.find('[data-stage]'), 'clientWidth', { value: 640, configurable: true });
    s.window.dispatchEvent(new s.window.Event('resize'));
    await s.tick();
    assert.equal(s.panel, 2);
    assert.equal(s.find('.thumbnail-rail').scrollLeft, 208);
    assert.equal(s.find('[data-gallery-track]').style.transform, 'translateX(-1280px)');
    assert.equal(s.frames, 0);
  } finally { await s.close(); }
});

test('thumbnails, mobile controls and keyboard traverse all panels without remounting', async () => {
  const s = await scene();
  try {
    const instance = s.root;
    for (let index = 0; index < s.panels.length; index++) {
      s.click(`[data-thumbnail="${index}"]`);
      assert.equal(s.panel, index);
      assert.equal(s.find('.mobile-inspect').hidden, index < 2);
      assert.equal(s.find('[data-mobile-panel-count]').hidden, index >= 2);
      assert.equal(s.document.querySelector('#portfolio'), instance);
      assert.equal(s.find(`[data-slide="${index}"]`).inert, false);
    }
    s.click('[data-step="1"]'); assert.equal(s.panel, s.panels.length);
    s.key('Escape'); assert.equal(s.panel, s.panels.length - 1);
    s.key('Home'); assert.equal(s.panel, 0);
    s.click('[data-step="1"]'); assert.equal(s.panel, 1);
    s.click('[data-step="-1"]'); assert.equal(s.panel, 0);
    s.key('End'); assert.equal(s.panel, s.panels.length);
    assert.equal(s.find('[data-menu-context]').textContent, 'Links');
    assert.equal(s.find('[data-menu-title]').textContent, '');
    s.click('[data-end-return]'); assert.equal(s.panel, s.panels.length - 1);
    assert.equal(s.find('[data-menu-context]').textContent, 'Projects:');
    assert.equal(s.find('[data-menu-title]').textContent, s.panels.at(-1).title);
  } finally { await s.close(); }
});

test('About caption starts with navigation, keeps the project color, and exits on the same clock', async () => {
  const s = await scene('/about/', { reduced: false });
  try {
    s.click('[data-thumbnail="2"]');
    await s.tick(32);
    assert.equal(s.panel, 1, 'the slide has not crossed the selection midpoint yet');
    const title = s.find('[data-title]');
    assert.ok(title.textContent.length > 0 && title.textContent.length < s.panels[2].galleryTitle.length);
    assert.equal(s.find('.project-caption').style.getPropertyValue('--caption-color'), s.panels[2].palette.accent);
    await s.tick(160);
    assert.equal(title.textContent, s.panels[2].galleryTitle);
    await s.tick(400);
    s.click('[data-thumbnail="1"]');
    await s.tick(32);
    assert.equal(s.panel, 2);
    assert.ok(parseFloat(s.find('.caption-word').style.width) < s.find('[data-title-metrics]').getBoundingClientRect().width,
      'the title must start shrinking before selection changes back to About');
    await s.tick(160);
    assert.equal(s.find('.project-caption').hidden, true);
    assert.equal(title.textContent, '');
    await s.tick(400);
    assert.equal(s.frames, 0);
    s.click(`[data-thumbnail="${s.panels.length - 1}"]`); await s.tick();
    assert.equal(s.find('.project-caption').style.getPropertyValue('--caption-color'), s.panels.at(-1).palette.caption || s.panels.at(-1).palette.accent);
  } finally { await s.close(); }
});

test('a held About drag cannot stall the caption entrance or exit', async () => {
  const s = await scene('/about/', { reduced: false });
  const position = () => {
    const track = s.find('[data-gallery-track]');
    const x = Number(track.style.transform.match(/translateX\(([-.\d]+)px\)/)[1]);
    const inset = parseFloat(track.style.getPropertyValue('--gallery-inset')) || 0;
    return -x / (390 - inset);
  };
  try {
    s.pointer('pointerdown', 330, '[data-slide="1"] [data-profile-scroll]');
    s.pointer('pointermove', 130, '[data-stage]');
    await s.tick(16);
    assert.equal(s.panel, 2);
    const heldPosition = position();
    await s.tick(192);
    assert.equal(s.root.classList.contains('is-dragging'), true);
    assert.ok(Math.abs(position() - heldPosition) < .000001, 'card lift must not be mistaken for slide progress');
    assert.equal(s.find('[data-title]').textContent, s.panels[2].galleryTitle,
      'the full title must finish while the pointer and slide remain stationary');
    s.pointer('pointermove', 140, '[data-stage]');
    await s.tick(16);
    assert.equal(s.panel, 1);
    const returnPosition = position();
    await s.tick(192);
    assert.equal(s.root.classList.contains('is-dragging'), true);
    assert.ok(Math.abs(position() - returnPosition) < .000001);
    assert.equal(s.find('.project-caption').hidden, true);
    assert.equal(s.find('[data-title]').textContent, '');
    s.pointer('pointercancel', 140, '[data-stage]');
    await s.tick();
    assert.equal(s.panel, 1);
    assert.equal(s.frames, 0);
  } finally { await s.close(); }
});

test('article opening, replacement, reselecting and returning preserve the intended content and focus', async () => {
  const s = await scene('/about/');
  try {
    s.click('[data-menu-project="2"]'); await s.flush();
    assert.equal(s.article, '2'); assert.equal(s.panel, 2);
    assert.equal(s.document.activeElement, s.find('[data-detail-title]'));
    s.find('[data-project-view]').scrollTop = 240;
    s.click('[data-menu-project="2"]'); await s.flush();
    assert.equal(s.find('[data-project-view]').scrollTop, 240);
    s.click('[data-menu-project="3"]'); await s.flush();
    assert.equal(s.article, '3'); assert.equal(s.find('[data-project-view]').scrollTop, 0);
    assert.equal(s.find('[data-detail-case-study]').hidden, true);
    s.click('.back-button'); await s.flush();
    assert.equal(s.find('[data-project-view]').hidden, true);
    assert.equal(s.panel, 3);
    assert.equal(s.address, `/projects/#slide=${s.panels[3].slug}`);
    assert.equal(s.find('.carousel').inert, false);
  } finally { await s.close(); }
});

test('closing during an article opening keeps the URL on its revealed return cover', async () => {
  const s = await scene('/about/');
  try {
    s.click('[data-menu-project="4"]');
    s.key('Escape');
    await s.flush();
    assert.equal(s.find('[data-project-view]').hidden, true);
    assert.equal(s.panel, 4);
    assert.equal(s.address, `/projects/#slide=${s.panels[4].slug}`);
  } finally { await s.close(); }
});

for (const interruption of ['resize', 'hidden']) {
  test(`${interruption} during a held swipe settles the nearest panel and releases input`, async () => {
    const s = await scene('/', { reduced: false });
    try {
      s.pointer('pointerdown', 330);
      s.pointer('pointermove', 80);
      await s.tick(32);
      assert.equal(s.root.classList.contains('is-dragging'), true);
      if (interruption === 'resize') s.window.dispatchEvent(new s.window.Event('resize'));
      else {
        Object.defineProperty(s.document, 'hidden', { value: true, configurable: true });
        s.document.dispatchEvent(new s.window.Event('visibilitychange'));
      }
      await s.tick();
      assert.equal(s.root.classList.contains('is-dragging'), false);
      assert.equal(s.find('[data-gallery-track]').style.transform, 'translateX(-390px)');
      assert.equal(s.address, '/about/');
      assert.equal(s.frames, 0, 'no abandoned animation loop');
      s.key('ArrowRight'); await s.tick(); assert.equal(s.panel, 2);
    } finally { await s.close(); }
  });
}

test('one thumbnail-wheel gesture adds one history destination after settling', async () => {
  const s = await scene();
  try {
    const before = s.window.history.length;
    for (let i = 0; i < 4; i++) s.find('.thumbnail-rail').dispatchEvent(new s.window.WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 88
    }));
    assert.equal(s.window.history.length, before, 'intermediate wheel positions must not become Back-button stops');
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(s.window.history.length, before + 1);
    assert.equal(s.panel, 4);
  } finally { await s.close(); }
});

test('menu keyboard navigation, nested disclosure and outside dismissal retain correct focus', async () => {
  const s = await scene();
  try {
    s.key('ArrowDown', '[data-menu] > summary');
    assert.equal(s.find('[data-menu]').dataset.expanded, 'true');
    assert.equal(s.document.activeElement, s.find('[data-menu-home]'));
    s.key('ArrowDown', '[data-menu-home]');
    assert.equal(s.document.activeElement, s.find('[data-menu-about]'));
    s.key('ArrowRight', '[data-projects-toggle]');
    assert.equal(s.find('[data-projects-menu]').dataset.expanded, 'true');
    assert.equal(s.document.activeElement, s.find('[data-menu-project="2"]'));
    s.key('Escape', '[data-menu-project="2"]');
    assert.equal(s.find('[data-projects-menu]').dataset.expanded, 'false');
    assert.equal(s.document.activeElement, s.find('[data-projects-toggle]'));
    s.key('Escape', '[data-projects-toggle]');
    assert.equal(s.find('[data-menu]').dataset.expanded, 'false');
    assert.equal(s.document.activeElement, s.find('[data-menu] > summary'));
    s.click('[data-menu] > summary');
    s.find('.carousel').dispatchEvent(new s.window.PointerEvent('pointerdown', { bubbles: true }));
    assert.equal(s.find('[data-menu]').dataset.expanded, 'false');
  } finally { await s.close(); }
});

test('native touch swipes own horizontal movement while vertical intent and pinch cancel cleanly', async () => {
  const s = await scene();
  try {
    const surface = s.find('[data-profile-scroll]');
    const touch = (type, x, y, count = 1) => {
      const points = Array.from({ length: count }, (_, identifier) => ({ identifier, clientX: x, clientY: y }));
      const event = new s.window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : points }, changedTouches: { value: points } });
      surface.dispatchEvent(event);
      return event;
    };
    touch('touchstart', 330, 200);
    assert.equal(touch('touchmove', 80, 202).defaultPrevented, true);
    await s.tick(32); touch('touchend', 80, 202);
    assert.equal(s.panel, 1); assert.equal(s.address, '/about/');
    s.key('Home');
    touch('touchstart', 300, 200);
    assert.equal(touch('touchmove', 298, 120).defaultPrevented, false);
    touch('touchend', 298, 120);
    assert.equal(s.panel, 0);
    touch('touchstart', 330, 200); touch('touchmove', 280, 202);
    await s.tick(32); touch('touchstart', 270, 202, 2);
    assert.equal(s.root.classList.contains('is-dragging'), false);
    assert.equal(s.panel, 0);
    s.click('[data-step="1"]'); assert.equal(s.panel, 1);
  } finally { await s.close(); }
});

test('About anchors, skip links and reading positions survive leaving and returning', async () => {
  const s = await scene('/about/');
  try {
    s.click('a[href="#interests"]');
    assert.equal(s.address, '/about/#interests');
    assert.equal(s.document.activeElement, s.find('#interests'));
    const reading = s.find('[data-slide="1"] [data-profile-scroll]');
    reading.scrollTop = 425;
    s.click('[data-menu-home]'); s.click('[data-menu-about]');
    assert.equal(reading.scrollTop, 425);
    s.click('.skip-link');
    assert.equal(s.document.activeElement, s.find('#about-title'));
    s.click('[data-menu-project="2"]'); await s.flush();
    s.click('.skip-link');
    assert.equal(s.document.activeElement, s.find('[data-detail-title]'));
    const jump = s.find('[data-case-study-jump]');
    s.click('[data-case-study-jump]');
    assert.equal(s.document.activeElement.id, jump.dataset.caseStudyJump);
  } finally { await s.close(); }
});

test('rapid article and section requests honor the latest destination', async () => {
  const s = await scene();
  try {
    s.click('[data-menu-project="2"]');
    s.click('[data-menu-project="3"]');
    s.click('[data-menu-project="5"]'); await s.flush();
    assert.equal(s.article, '5'); assert.equal(s.panel, 5);
    assert.equal(s.address, `/projects/#project=${s.panels[5].slug}`);
    s.click('[data-menu-project="4"]');
    s.click('[data-menu-home]');
    s.click('[data-menu-about]'); await s.flush();
    assert.equal(s.find('[data-project-view]').hidden, true);
    assert.equal(s.panel, 1); assert.equal(s.address, '/about/');
    assert.equal(s.document.activeElement, s.find('#about-title'));
  } finally { await s.close(); }
});

test('Back and Forward restore articles and sections without creating history entries', async () => {
  const s = await scene();
  try {
    s.key('End');
    s.click('[data-menu-about]');
    s.click('[data-menu-project="3"]'); await s.flush();
    const entries = s.window.history.length;
    s.window.history.back();
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.panel, 1); assert.equal(s.find('[data-project-view]').hidden, true);
    s.window.history.back();
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.panel, s.panels.length);
    assert.equal(s.find('[data-menu-context]').textContent, 'Links');
    assert.equal(s.find('[data-menu-title]').textContent, '');
    assert.equal(s.find('[data-menu] > summary').getAttribute('aria-label'), 'Open navigation. Links');
    assert.equal(s.document.title, 'Derek Stone - Links');
    s.window.history.forward();
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.panel, 1);
    s.window.history.forward();
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.article, '3'); assert.equal(s.panel, 3);
    assert.equal(s.window.history.length, entries);
  } finally { await s.close(); }
});

test('offline navigation messages follow the same routes and ignore unrelated senders', async () => {
  const s = await scene();
  try {
    const address = `/projects/#project=${s.panels[4].slug}`;
    s.window.dispatchEvent(new s.window.MessageEvent('message', { source: {}, data: { type: 'portfolio-preview-navigate', address } }));
    await s.flush(); assert.equal(s.panel, 0);
    s.window.dispatchEvent(new s.window.MessageEvent('message', { source: s.window.parent, data: { type: 'portfolio-preview-navigate', address } }));
    await s.flush(); assert.equal(s.article, '4');
    s.window.dispatchEvent(new s.window.MessageEvent('message', { source: s.window.parent, data: { type: 'portfolio-preview-navigate', address: '/about/#interests' } }));
    await s.flush(); assert.equal(s.panel, 1); assert.equal(s.document.activeElement, s.find('#interests'));
  } finally { await s.close(); }
});

test('direct-page preview navigation uses its local address bridge and restores Art from history', async () => {
  const s = await scene();
  const addresses = [];
  try {
    s.window.__PORTFOLIO_PREVIEW_ADDRESS__ = '/';
    s.window.__PORTFOLIO_PREVIEW_SET_ADDRESS__ = entry => addresses.push(entry);
    s.click('[data-menu-about]');
    assert.equal(s.panel, 1);
    assert.equal(addresses.at(-1).address, '/about/');
    s.window.dispatchEvent(new s.window.CustomEvent('portfolio:preview-navigate', {
      detail: { address: '/projects/#project=art' }
    }));
    await s.flush();
    assert.equal(s.article, String(s.panels.length - 1));
    s.click('.back-button'); await s.flush();
    assert.equal(addresses.at(-1).address, '/projects/#slide=art');
    s.window.dispatchEvent(new s.window.CustomEvent('portfolio:preview-navigate', {
      detail: { address: '//unrelated.invalid/' }
    }));
    assert.equal(s.panel, s.panels.length - 1);
    assert.equal(s.window.__PORTFOLIO_PREVIEW_ADDRESS__, '/projects/#slide=art');
  } finally { await s.close(); }
});

test('Art opens as the final project with five full photos, section jumps and credits', async () => {
  const s = await scene('/projects/#project=art');
  try {
    const index = s.panels.length - 1;
    assert.equal(s.panels[index].slug, 'art');
    assert.equal(s.article, String(index));
    assert.equal(s.find('[data-detail-eyebrow]').textContent, 'A personal collection');
    assert.equal(s.find('[data-detail-period]').hidden, true);
    const host = s.find('[data-detail-case-study]');
    assert.equal(host.dataset.layout, 'art');
    const sections = [...host.querySelectorAll('.case-study-section')];
    assert.equal(sections.length, 5);
    const paths = ['stellers-jay', 'broken-line-chicken', 'ink-chicken', 'bird-stamp', 'watercolors'];
    for (let i = 0; i < sections.length; i++) {
      const image = sections[i].querySelector('img');
      assert.equal(image.getAttribute('src'), `/art/collection/${paths[i]}.webp`);
      assert.equal(image.width, 2048); assert.equal(image.height, 1536);
      await access(new URL(`../dist/art/collection/${paths[i]}.webp`, import.meta.url));
      assert.equal(sections[i].children[1].className, 'case-study-media case-study-media-first');
      assert.equal(sections[i].querySelectorAll(':scope > .case-study-prose').length, 1);
      assert.equal(sections[i].querySelector('h2').textContent, String(i + 1).padStart(2, '0'));
      assert.equal(image.loading, 'lazy');
    }
    const cover = s.find('[data-slide="' + index + '"] img');
    assert.equal(cover.style.objectFit, 'cover');
    assert.equal(cover.getAttribute('src'), '/art/collection/overprint-cover.webp');
    assert.equal(cover.width, 1582); assert.equal(cover.height, 2048);
    assert.deepEqual([...host.querySelectorAll('.case-study-section strong')].map(x => x.textContent), ['pigment', 'broken line painting', 'not', 'no birds']);
    assert.deepEqual([...host.querySelectorAll('.case-study-section em')].map(x => x.textContent), ['all blue birds for that matter', 'relatively', 'especially']);
    assert.equal(host.querySelectorAll('.project-footnote').length, 4);
    assert.match(host.querySelector('#project-note-art-0').textContent, /\[0\] The cover for this section in the gallery was created using evolution and a loss function/);
    assert.equal(host.querySelector('#project-note-art-0 a[role="doc-backlink"]'), null);
    const coverNote = host.querySelector('#project-note-art-0');
    assert.equal(coverNote.querySelectorAll(':scope > p').length, 1);
    assert.match(coverNote.querySelector('p').textContent, /reference\. All images used appear to be public domain and can be found here: Sources\./);
    const sourcesDialog = host.querySelector('[data-source-dialog]');
    assert.equal(sourcesDialog.querySelectorAll('.source-list li').length, 13);
    assert.match(sourcesDialog.querySelector('.source-list li').textContent, /507 Mechanical Movements/);
    s.click('[data-source-open]');
    assert.equal(sourcesDialog.open, true);
    s.click('[data-source-close]');
    assert.equal(sourcesDialog.open, false);
    assert.equal(host.querySelectorAll('[role=\"doc-noteref\"]').length, 3);
    for (const marker of host.querySelectorAll('.project-noteref')) {
      assert.match(marker.parentElement.textContent, /\S \[\d+\]/, 'footnotes need one separating space');
    }
    assert.match(sections[0].textContent, /blue frequencies of light\. \[1\]/);
    assert.match(host.querySelector('#project-note-art-3').textContent, /Valorant/);
    assert.match(host.querySelector('#project-note-art-2').textContent, /Einstein/);
    const source = host.querySelector('#project-note-art-1 a[href^=\"https:\"]');
    const birdNote = host.querySelector('#project-note-art-1');
    assert.equal(birdNote.querySelectorAll(':scope > p').length, 1);
    assert.equal(source.parentElement, birdNote.querySelector('p'));
    assert.match(source.parentElement.textContent, /mentioned: https:\/\/academy\.allaboutbirds\.org/);
    assert.equal(source.href, 'https://academy.allaboutbirds.org/how-birds-make-colorful-feathers/');
    assert.equal(source.rel, 'noopener noreferrer');
    s.click('[aria-label=\"Footnote 2\"]');
    assert.equal(s.document.activeElement.id, 'project-note-art-2');
    assert.equal(s.address, '/projects/#project=art');
    s.click('[aria-label=\"Back to reference 2\"]');
    assert.equal(s.document.activeElement.id, 'project-ref-art-2');
    const jumps = [...host.querySelectorAll('[data-case-study-jump]')];
    s.click(`[data-case-study-jump="${jumps[4].dataset.caseStudyJump}"]`);
    assert.equal(s.document.activeElement.id, jumps[4].dataset.caseStudyJump);
    s.click('[data-source-open]');
    s.click('.back-button'); await s.flush();
    assert.equal(sourcesDialog.open, false, 'the sources dialog closes when leaving the article');
    assert.equal(s.panel, index);
    assert.equal(s.address, '/projects/#slide=art');
    s.key('End');
    assert.equal(s.panel, s.panels.length);
    s.click('[data-end-return]');
    assert.equal(s.panel, index);
  } finally { await s.close(); }
});

test('Art keeps the header accent on its title across gallery and article navigation', async () => {
  const s = await scene('/projects/#slide=art');
  try {
    const assertAccent = () => {
      assert.equal(s.root.style.getPropertyValue('--accent'), '#c90062');
      assert.equal(s.find('.project-caption').style.getPropertyValue('--caption-color'), '#c90062');
    };
    assertAccent();
    s.click('.caption-link'); await s.flush();
    s.click('.back-button'); await s.flush();
    assertAccent();
    s.click('[data-menu-project="2"]'); await s.flush();
    s.click(`[data-menu-project="${s.panels.length - 1}"]`); await s.flush();
    s.click('.back-button'); await s.flush();
    assertAccent();
  } finally { await s.close(); }
});

test('enlarging a photo preserves the article, scroll position, focus and address', async () => {
  const s = await scene('/projects/#project=art');
  try {
    const article = s.find('[data-project-view]');
    const button = s.find('.case-study-section [data-image-open]');
    const dialog = s.find('[data-image-viewer]');
    article.scrollTop = 740;
    button.focus();
    s.click('.case-study-section [data-image-open]');
    assert.equal(dialog.open, true);
    assert.equal(article.style.overflow, 'hidden');
    assert.equal(s.find('[data-image-full]').src, button.querySelector('img').src);
    assert.equal(s.find('[data-image-full]').alt, button.querySelector('img').alt);
    assert.equal(s.document.activeElement, s.find('[data-image-close]'));
    s.key('ArrowRight', '[data-image-close]');
    assert.equal(s.address, '/projects/#project=art');
    assert.equal(s.article, String(s.panels.findIndex(panel => panel.slug === 'art')));
    s.click('[data-image-close]');
    assert.equal(dialog.open, false);
    assert.equal(article.style.overflow, '');
    assert.equal(article.scrollTop, 740);
    assert.equal(s.document.activeElement, button);
    assert.equal(s.find('[data-image-full]').hasAttribute('src'), false);
    s.click('.case-study-section [data-image-open]');
    s.key('Escape', '[data-image-close]');
    dialog.dispatchEvent(new s.window.Event('cancel', { cancelable: true }));
    assert.equal(dialog.open, false);
    assert.equal(article.hidden, false, 'Escape closes only the image, leaving the article open');
    assert.equal(s.address, '/projects/#project=art');
    s.click('.case-study-section [data-image-open]');
    s.click('[data-image-canvas]');
    assert.equal(dialog.open, false, 'blank space around the photo dismisses it');
  } finally { await s.close(); }
});

test('gradual zoom reaches decoded source resolution, pans without resetting and retains detail on resize', async () => {
  const s = await scene('/projects/#project=art');
  try {
    s.click('.case-study-section [data-image-open]');
    const full = s.find('[data-image-full]');
    const canvas = s.find('[data-image-canvas]');
    const dialog = s.find('[data-image-viewer]');
    Object.defineProperties(full, { naturalWidth: { value: 1440 }, naturalHeight: { value: 1080 } });
    full.dispatchEvent(new s.window.Event('load'));
    const drawn = () => {
      const match = full.style.transform.match(/translate3d\(([-+e.\d]+)px, ([-+e.\d]+)px, 0\) scale\(([-+e.\d]+)\)/);
      assert.ok(match, 'the photo has an explicit fitted size and viewing transform');
      return match.slice(1).map(Number);
    };
    const fitted = s.find('[data-image-scale]').textContent;
    const area = [canvas.style.width, canvas.style.height];
    s.click('[data-image-zoom]');
    assert.equal(canvas.hasAttribute('data-zoomed'), true);
    assert.ok(parseInt(s.find('[data-image-scale]').textContent) > parseInt(fitted));
    assert.ok(parseInt(s.find('[data-image-scale]').textContent) < 100, 'the first step is gradual');
    s.find('[data-image-zoom]').focus();
    for (let i = 0; i < 5; i++) s.click('[data-image-zoom]');
    assert.equal(s.find('[data-image-scale]').textContent, '100%');
    assert.equal(s.find('[data-image-zoom]').getAttribute('aria-disabled'), 'true');
    assert.equal(s.document.activeElement, s.find('[data-image-zoom]'), 'reaching a zoom limit preserves keyboard focus');
    assert.equal(parseFloat(full.style.width) * drawn()[2], 1440, 'stop at the decoded width, even if metadata is larger');
    assert.equal(parseFloat(full.style.height) * drawn()[2], 1080);
    assert.deepEqual([canvas.style.width, canvas.style.height], area, 'zoom cannot resize the surrounding viewer');
    const [left, top] = drawn();
    const pointer = (type, x, y) => canvas.dispatchEvent(new s.window.PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 11, pointerType: 'mouse', button: 0, clientX: x, clientY: y
    }));
    pointer('pointerdown', 200, 200);
    pointer('pointermove', 150, 180);
    pointer('pointerup', 150, 180);
    assert.equal(drawn()[0], left - 50);
    assert.equal(drawn()[1], top - 20);
    assert.equal(canvas.hasPointerCapture(11), false);
    s.click('[data-image-canvas]');
    assert.equal(dialog.open, true, 'a click emitted by finishing a drag must not dismiss the viewer');
    assert.equal(canvas.hasAttribute('data-zoomed'), true);
    s.click('[data-image-full]');
    assert.equal(canvas.hasAttribute('data-zoomed'), true, 'an ordinary click never throws away the inspected detail');
    assert.equal(dialog.open, true);
    s.click('[data-image-fit]');
    assert.equal(canvas.hasAttribute('data-zoomed'), false);
    assert.equal(s.find('[data-image-scale]').textContent, fitted);
    s.click('[data-image-zoom]');
    const beforeArrow = drawn()[0];
    const arrow = new s.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' });
    canvas.dispatchEvent(arrow);
    assert.equal(arrow.defaultPrevented, true);
    assert.equal(drawn()[0], beforeArrow - 48, 'keyboard arrows pan the enlarged photo');
    assert.equal(s.address, '/projects/#project=art');
    canvas.focus();
    const inspectedScale = s.find('[data-image-scale]').textContent;
    s.window.innerWidth = 320;
    s.window.dispatchEvent(new s.window.Event('resize'));
    assert.equal(canvas.hasAttribute('data-zoomed'), true);
    assert.equal(s.find('[data-image-scale]').textContent, inspectedScale);
    assert.equal(canvas.style.width, '320px');
    assert.equal(s.document.activeElement, canvas);
    s.key('0', '[data-image-canvas]');
    assert.equal(canvas.hasAttribute('data-zoomed'), false);
    assert.equal(s.find('[data-image-zoom-out]').getAttribute('aria-disabled'), 'true');
  } finally { await s.close(); }
});

test('wheel zoom stays under the cursor and touch pinch, pan and double tap stay inside the viewer', async () => {
  const s = await scene('/projects/#project=art');
  try {
    s.click('.case-study-section [data-image-open]');
    const full = s.find('[data-image-full]'), canvas = s.find('[data-image-canvas]');
    const dialog = s.find('[data-image-viewer]');
    const transform = () => {
      const match = full.style.transform.match(/translate3d\(([-+e.\d]+)px, ([-+e.\d]+)px, 0\) scale\(([-+e.\d]+)\)/);
      assert.ok(match, `Invalid image transform: ${full.style.transform}`);
      return match.slice(1).map(Number);
    };
    const point = { x: 130, y: parseFloat(canvas.style.height) / 2 }, before = transform();
    const wheel = new s.window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, clientX: point.x, clientY: point.y });
    // happy-dom's WheelEvent omits its inherited mouse coordinates.
    Object.defineProperties(wheel, { clientX: { value: point.x }, clientY: { value: point.y } });
    canvas.dispatchEvent(wheel);
    const after = transform();
    assert.equal(wheel.defaultPrevented, true);
    for (let axis = 0; axis < 2; axis++) {
      const coordinate = axis ? point.y : point.x;
      assert.ok(Math.abs((coordinate - before[axis]) / before[2] - (coordinate - after[axis]) / after[2]) < .00001);
    }
    const touch = (type, id, x, y) => canvas.dispatchEvent(new s.window.PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', button: 0, clientX: x, clientY: y
    }));
    const level = parseInt(s.find('[data-image-scale]').textContent);
    touch('pointerdown', 21, 100, 350);
    touch('pointerdown', 22, 200, 450);
    touch('pointermove', 21, 60, 310);
    touch('pointermove', 22, 240, 490);
    assert.ok(parseInt(s.find('[data-image-scale]').textContent) > level);
    touch('pointerup', 22, 240, 490);
    touch('pointermove', 21, 50, 300);
    touch('pointerup', 21, 50, 300);
    s.click('[data-image-canvas]');
    assert.equal(dialog.open, true, 'the compatibility click after a pinch must not dismiss it');
    assert.equal(canvas.hasPointerCapture(21), false);
    assert.equal(canvas.hasPointerCapture(22), false);
    assert.equal(canvas.hasAttribute('data-panning'), false);
    s.click('[data-image-fit]');
    for (let i = 0; i < 2; i++) {
      touch('pointerdown', 23, 150, 400);
      touch('pointerup', 23, 150, 400);
      s.click('[data-image-full]');
      await s.tick(80);
    }
    assert.equal(canvas.hasAttribute('data-zoomed'), true, 'double tap deliberately enlarges the touched area');
    touch('pointerdown', 24, 150, 400);
    touch('pointercancel', 24, 150, 400);
    assert.equal(canvas.hasPointerCapture(24), false);
    s.click('[data-image-close]');
    assert.equal(dialog.open, false);
    assert.equal(full.style.transform, '');
    assert.equal(s.address, '/projects/#project=art');
  } finally { await s.close(); }
});

test('zoom transitions can be interrupted by input, closing and reduced motion', async () => {
  const s = await scene('/projects/#project=art', { reduced: false });
  try {
    s.click('.case-study-section [data-image-open]');
    const full = s.find('[data-image-full]');
    const initial = full.style.transform;
    s.click('[data-image-zoom]');
    assert.equal(full.style.transform, initial, 'a discrete zoom starts from the drawn position');
    await s.tick(64);
    const intermediate = full.style.transform;
    assert.notEqual(intermediate, initial);
    const preference = s.window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.matches = true;
    const change = new s.window.Event('change'); change.matches = true;
    preference.dispatchEvent(change);
    assert.notEqual(full.style.transform, intermediate, 'reduced motion settles the requested zoom immediately');
    const settled = full.style.transform;
    await s.tick(200);
    assert.equal(full.style.transform, settled, 'no cancelled zoom frame can overwrite the settled image');
    s.click('[data-image-close]');
    await s.tick(200);
    assert.equal(full.style.transform, '');
    assert.equal(s.find('[data-image-viewer]').open, false);
  } finally { await s.close(); }
});

test('viewer motion can be interrupted and reduced motion finishes dismissal immediately', async () => {
  const s = await scene('/projects/#project=art', { reduced: false });
  try {
    const dialog = s.find('[data-image-viewer]');
    const effects = [];
    dialog.animate = (frames, options) => {
      let resolve, reject;
      const effect = { frames, options, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); }, cancel() { this.cancelled = true; reject(new Error('cancelled')); }
      };
      effects.push(effect); return effect;
    };
    s.click('.case-study-section [data-image-open]');
    assert.equal(effects[0].options.duration, 180);
    s.click('[data-image-zoom]');
    assert.equal(effects[0].cancelled, true, 'an early zoom uses the settled image geometry');
    s.click('[data-image-close]');
    assert.equal(effects[0].cancelled, true);
    assert.equal(effects[1].options.duration, 120);
    assert.equal(dialog.open, true, 'retain modal focus until the closing frame completes');
    const preference = s.window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.matches = true;
    const change = new s.window.Event('change'); change.matches = true;
    preference.dispatchEvent(change);
    assert.equal(dialog.open, false);
    assert.equal(effects[1].cancelled, true);
    effects[1].finish(); await s.flush();
    assert.equal(s.find('[data-project-view]').hidden, false);
    s.click('.case-study-section [data-image-open]');
    assert.equal(effects.length, 2, 'reduced motion suppresses the opening transition too');
    s.click('[data-image-close]');
    assert.equal(dialog.open, false);
  } finally { await s.close(); }
});

test('the image viewer survives rapid reopen and closes cleanly before article replacement', async () => {
  const s = await scene('/projects/#project=art');
  try {
    const dialog = s.find('[data-image-viewer]');
    const article = s.find('[data-project-view]');
    s.click('.case-study-section [data-image-open]');
    s.click('[data-image-close]');
    s.click('.case-study-section:nth-child(2) [data-image-open]');
    dialog.dispatchEvent(new s.window.Event('close'));
    assert.equal(dialog.open, true);
    assert.match(s.find('[data-image-full]').src, /broken-line-chicken/);
    assert.equal(article.style.overflow, 'hidden');
    s.click('[data-menu-project="2"]'); await s.flush();
    assert.equal(dialog.open, false);
    assert.equal(article.style.overflow, '');
    assert.equal(article.scrollTop, 0);
    assert.equal(s.find('[data-image-full]').hasAttribute('src'), false);
    assert.equal(s.find('[data-detail-title]').textContent, s.panels[2].title);
  } finally { await s.close(); }
});

test('replacing Art clears its layout, photos and label, and restores dated project metadata', async () => {
  const s = await scene('/projects/#project=art');
  try {
    s.click('[data-menu-project="2"]'); await s.flush();
    const host = s.find('[data-detail-case-study]');
    assert.equal(host.dataset.layout, '');
    assert.equal(s.find('[data-detail-period]').hidden, false);
    assert.equal(s.find('[data-detail-year]').textContent, '2026');
    assert.equal(s.find('[data-detail-eyebrow]').textContent, 'Project preview');
    assert.equal(host.querySelectorAll('img[src*="/collection/"]').length, 0);
    assert.equal(host.querySelectorAll('.case-study-media-first, .case-study-references, .project-footnotes').length, 0);
    s.click('[data-menu-project="3"]'); await s.flush();
    assert.equal(host.hidden, true);
    assert.equal(host.childElementCount, 0);
    s.click(`[data-menu-project="${s.panels.length - 1}"]`); await s.flush();
    assert.equal(host.querySelectorAll('img').length, 5);
    assert.equal(host.dataset.layout, 'art');
    assert.equal(s.find('[data-detail-period]').hidden, true);
  } finally { await s.close(); }
});

test('all compiled pages have valid local assets, links and accessibility references', async () => {
  for (const entry of ['', 'about/', 'projects/', 'resume/']) {
    const window = new Window({ url: `https://stonederek.github.io/${entry}`, settings: {
      disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
    } });
    try {
      window.document.write(await readFile(new URL(`../dist/${entry}index.html`, import.meta.url), 'utf8'));
      if (entry !== 'resume/') {
        assert.equal(window.document.querySelector('.menu-name').textContent, 'stonederek.github.io');
        const title = window.document.querySelector('#home-title');
        assert.equal(title.textContent, 'Derek Stone');
        assert.equal(title.nextElementSibling.className, 'introduction-divider');
        assert.equal(title.nextElementSibling.getAttribute('aria-hidden'), 'true');
        assert.equal(window.document.querySelector('.introduction-lead').textContent, 'Hi, I’m Derek.');
        if (entry !== 'projects/') {
          assert.equal(window.document.querySelector('[data-menu-context]').textContent, entry === 'about/' ? 'About' : 'Home');
          assert.equal(window.document.querySelector('[data-menu-title]').textContent, '');
        }
      }
      const ids = [...window.document.querySelectorAll('[id]')].map(node => node.id);
      assert.equal(new Set(ids).size, ids.length, `Duplicate IDs in ${entry || 'Home'}`);
      for (const node of window.document.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
        for (const name of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
          for (const id of (node.getAttribute(name) || '').split(/\s+/).filter(Boolean)) {
            assert.ok(window.document.getElementById(id), `Missing ${name} target ${id}`);
          }
        }
      }
      for (const node of window.document.querySelectorAll('[src], a[href], link[href]')) {
        const raw = node.getAttribute('src') || node.getAttribute('href');
        const url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin) continue;
        const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
        await access(new URL(`../dist${path}`, import.meta.url));
      }
      const covers = [...window.document.querySelectorAll('[data-slide][data-panel-kind="project"] img')];
      assert.equal(covers.filter(image => image.loading === 'eager').length, entry === '' ? 0 : entry === 'about/' ? 1 : entry === 'projects/' ? 2 : 0);
    } finally { await window.happyDOM.close(); }
  }
});

test('image warming reaches the next cover before entry without promoting all distant covers', async () => {
  const s = await scene();
  try {
    assert.equal(s.find('[data-slide="2"] img').loading, 'lazy');
    s.click('[data-menu-about]');
    assert.equal(s.find('[data-slide="2"] img').loading, 'eager');
    assert.equal(s.find('[data-slide="5"] img').loading, 'lazy');
    const target = s.panels.length - 2;
    s.click(`[data-thumbnail="${target}"]`);
    for (const index of [target - 1, target, target + 1]) assert.equal(s.find(`[data-slide="${index}"] img`).loading, 'eager');
  } finally { await s.close(); }
});

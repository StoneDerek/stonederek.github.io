import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { mountPortfolio } from '../src/scripts/carousel.js';

// Exercise production markup and the real controller. This is DOM simulation:
// geometry, time and canvas text metrics are supplied, not browser rendering.
async function scene(address = '/', { reduced = true, width = 390 } = {}) {
  const route = address.split('#')[0];
  const entry = route.includes('/projects') ? 'projects/' : route.includes('/about') ? 'about/' : '';
  const html = await readFile(new URL(`../dist/${entry}index.html`, import.meta.url), 'utf8');
  const window = new Window({ url: `https://stonederek.github.io${address}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  const { document } = window;
  window.ontouchstart = null;
  document.write(html);
  const root = document.querySelector('#portfolio');
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
    const w = this.matches('.thumbnail') ? 88 : this.matches('.caption-word, [data-title-metrics]') ? this.textContent.length * 8 : width;
    return { x: 0, y: 0, left: 0, right: w, top: 0, bottom: 64, width: w, height: 64 };
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
    getComputedStyle: style, CSS: { supports: () => false }, performance: { now: () => clock },
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
  try { cleanup = mountPortfolio(); await cleanup.entryDone; await flush(); }
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
      if (article !== null) assert.equal(Number(s.article), article, address);
    } finally { await s.close(); }
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
    s.click('[data-end-return]'); assert.equal(s.panel, s.panels.length - 1);
  } finally { await s.close(); }
});

test('About caption starts with navigation, keeps the project color, and exits on the same clock', async () => {
  const s = await scene('/about/', { reduced: false });
  try {
    s.click('[data-thumbnail="2"]');
    await s.tick(32);
    assert.equal(s.panel, 1, 'the slide has not crossed the selection midpoint yet');
    const title = s.find('[data-title]');
    assert.ok(title.textContent.length > 0 && title.textContent.length < s.panels[2].title.length);
    assert.equal(s.find('.project-caption').style.getPropertyValue('--caption-color'), s.panels[2].palette.accent);
    await s.tick(160);
    assert.equal(title.textContent, s.panels[2].title);
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
    s.click('[data-thumbnail="7"]'); await s.tick();
    assert.equal(s.find('.project-caption').style.getPropertyValue('--caption-color'), s.panels[7].palette.accent);
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
    assert.equal(s.find('[data-title]').textContent, s.panels[2].title,
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
    s.click('[data-menu-about]');
    s.click('[data-menu-project="3"]'); await s.flush();
    const entries = s.window.history.length;
    s.window.history.back();
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.panel, 1); assert.equal(s.find('[data-project-view]').hidden, true);
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
    assert.equal(cover.getAttribute('src'), '/art/collection/overprint-difference.webp');
    assert.equal(cover.width, 1582); assert.equal(cover.height, 2048);
    assert.deepEqual([...host.querySelectorAll('.case-study-section strong')].map(x => x.textContent), ['pigment', 'broken line painting', 'not', 'no birds']);
    assert.deepEqual([...host.querySelectorAll('.case-study-section em')].map(x => x.textContent), ['all blue birds for that matter', 'relatively', 'especially']);
    assert.equal(host.querySelectorAll('.project-footnote').length, 3);
    assert.equal(host.querySelectorAll('[role=\"doc-noteref\"]').length, 3);
    for (const marker of host.querySelectorAll('.project-noteref')) {
      assert.match(marker.parentElement.textContent, /\S \[\d+\]/, 'footnotes need one separating space');
    }
    assert.match(sections[0].textContent, /blue frequencies of light\. \[1\]/);
    assert.match(host.querySelector('#project-note-art-3').textContent, /Valorant/);
    assert.match(host.querySelector('#project-note-art-2').textContent, /Einstein/);
    const source = host.querySelector('#project-note-art-1 a[href^=\"https:\"]');
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
    s.click('.back-button'); await s.flush();
    assert.equal(s.panel, index);
    assert.equal(s.address, '/projects/#slide=art');
    s.key('End');
    assert.equal(s.panel, s.panels.length);
    s.click('[data-end-return]');
    assert.equal(s.panel, index);
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
    assert.equal(s.find('[data-detail-eyebrow]').textContent, 'Placeholder project');
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
    s.click('[data-thumbnail="5"]');
    for (const index of [4, 5, 6]) assert.equal(s.find(`[data-slide="${index}"] img`).loading, 'eager');
  } finally { await s.close(); }
});

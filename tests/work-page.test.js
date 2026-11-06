import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import HistoryItemList from 'happy-dom/lib/history/HistoryItemList.js';
import { mountWorkPage } from '../src/scripts/work-page.js';

const projects = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
const placeholder = await readFile(new URL('../src/components/PlaceholderParagraph.astro', import.meta.url), 'utf8');
const workData = projects.map(({ slug, legacySlugs, title }) => ({ slug, legacySlugs, title }));

// HappyDOM 21 truncates Forward entries in replaceState. Match browser
// semantics so scrolling a restored grid can update its history snapshot.
HistoryItemList.prototype.replace = function(item) {
  const index = this.items.indexOf(this.currentItem);
  if (index < 0) throw new Error('Current history item not found');
  this.items[index] = item;
  this.currentItem = item;
};

// Focus and history are real DOM behavior here. Only browser layout/scrolling
// and animation frames are supplied; the Work controller is real.
async function scene(address = '/projects/', { base = '/', previous = null, preview = false } = {}) {
  const window = new Window({ url: `https://portfolio.example${preview ? '/portfolio-preview.html' : previous || address}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  if (previous) window.history.pushState({ retained: true }, '', address);
  const { document } = window;
  const grid = `${base}projects/`;
  document.write(`<html><head><title>Derek Stone - Work</title></head><body>
    <main data-work-root data-base="${base}" data-owner="Derek Stone">
      <a class="serif-skip-link" href="#work-content">Skip to content</a>
      <nav><a data-work-index href="${grid}">Work</a><a id="about" href="${base}about/#interests">About</a><a id="resume" href="${base}resume/">Resume</a></nav>
      <section data-work-grid><h1 data-work-heading tabindex="-1">Work</h1>
        ${projects.filter(project => project.slug !== 'art').map(project => `<a data-work-project="${project.slug}" href="${grid}#project=${project.slug}">${project.title}</a>`).join('')}
      </section>
      <section data-work-article data-project-view hidden><a data-work-close href="${grid}">Back to Work</a>
        <h1 class="sr-only" data-detail-title tabindex="-1"></h1>${placeholder}
      </section>
      <script id="work-data" type="application/json">${JSON.stringify(workData).replace(/</g, '\\u003c')}</script>
    </main></body></html>`);
  window.matchMedia = () => Object.assign(new window.EventTarget(), { matches: true });
  let scroll = { x: 0, y: 0 };
  Object.defineProperties(window, { scrollX: { configurable: true, get: () => scroll.x }, scrollY: { configurable: true, get: () => scroll.y } });
  window.scrollTo = (position, y) => {
    scroll = typeof position === 'number' ? { x: position, y } : { x: position.left || 0, y: position.top || 0 };
  };
  let scrolledTarget = null;
  for (const target of document.querySelectorAll('[data-work-heading], [data-detail-title]')) {
    target.scrollIntoView = () => { scrolledTarget = target; scroll = { x: 0, y: 0 }; };
  }
  const frames = new Map();
  let next = 0;
  window.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const globals = { AbortController: window.AbortController,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let previewWrites = 0;
  let mounted = false;
  let redirectDuringMount = false;
  if (preview) {
    window.__PORTFOLIO_PREVIEW_ADDRESS__ = address;
    const encode = route => `#preview=${encodeURIComponent(route)}`;
    window.history.replaceState(window.history.state, '', encode(address));
    for (const link of document.querySelectorAll('[data-work-project], [data-work-close], [data-work-index]')) {
      const route = link.getAttribute('href');
      link.dataset.previewAddress = route;
      link.href = `/portfolio-preview.html${encode(route)}`;
    }
    window.__PORTFOLIO_PREVIEW_SET_ADDRESS__ = ({ address: route, replace, state }) => {
      previewWrites++;
      if (route.startsWith(`${base}art/`) && !mounted) redirectDuringMount = true;
      window.__PORTFOLIO_PREVIEW_ADDRESS__ = route;
      window.history[replace ? 'replaceState' : 'pushState'](state, '', encode(route));
    };
    window.addEventListener('popstate', () => {
      const route = new URLSearchParams(window.location.hash.slice(1)).get('preview');
      window.__PORTFOLIO_PREVIEW_ADDRESS__ = route;
      window.dispatchEvent(new window.CustomEvent('portfolio:preview-navigate', { detail: { address: route } }));
    });
  }
  const root = document.querySelector('[data-work-root]');
  root.style.setProperty('--accent', '#123456');
  root.style.setProperty('--ink', '#fedcba');
  document.documentElement.setAttribute('data-portfolio-entry-pending', '');
  let cleanup;
  const flush = async () => {
    for (let i = 0; i < 8 && frames.size; i++) {
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback(0));
      await Promise.resolve();
    }
  };
  const history = async direction => {
    window.history[direction]();
    await new Promise(resolve => setTimeout(resolve, 0));
    await flush();
  };
  const find = selector => { const node = root.querySelector(selector); assert.ok(node, `Missing ${selector}`); return node; };
  const click = (selector, options = {}) => {
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...options });
    find(selector).dispatchEvent(event);
    return event;
  };
  const close = async () => {
    cleanup?.();
    await window.happyDOM.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
  try { cleanup = mountWorkPage(root); mounted = true; await flush(); }
  catch (error) { await close(); throw error; }
  return { window, document, root, find, click, flush, history, close, unmount: () => cleanup?.(),
    get address() { return preview ? window.__PORTFOLIO_PREVIEW_ADDRESS__ : window.location.pathname + window.location.hash; },
    get y() { return scroll.y; }, get previewWrites() { return previewWrites; },
    get redirectDuringMount() { return redirectDuringMount; },
    get scrolledTarget() { return scrolledTarget; },
    async scrollTo(y) { scroll = { x: 0, y }; window.dispatchEvent(new window.Event('scroll')); await flush(); }
  };
}

test('Work opens each project with only one placeholder paragraph and preserves its route and title', async () => {
  const s = await scene('/portfolio/projects/', { base: '/portfolio/' });
  try {
    assert.equal(s.find('[data-work-grid]').hidden, false);
    assert.equal(s.find('[data-work-article]').hidden, true);
    assert.equal(s.document.documentElement.hasAttribute('data-portfolio-entry-pending'), false);
    assert.equal(s.root.querySelectorAll('[data-work-project]').length, 3);
    for (const project of projects.filter(project => project.slug !== 'art')) {
      s.click(`[data-work-project="${project.slug}"]`); await s.flush();
      assert.equal(s.address, `/portfolio/projects/#project=${project.slug}`);
      assert.equal(s.find('[data-work-grid]').hidden, true);
      const article = s.find('[data-work-article]');
      assert.equal(article.hidden, false);
      assert.equal(article.querySelectorAll('p').length, 1);
      assert.match(article.querySelector('p').textContent, /^Lorem ipsum dolor sit amet,/);
      assert.equal(article.querySelector('img, dialog, .case-study-section, [data-detail-description], [data-detail-note]'), null);
      assert.equal(s.find('[data-detail-title]').textContent, project.title);
      assert.equal(s.document.title, `Derek Stone - ${project.title}`);
      assert.equal(s.document.activeElement, s.find('[data-detail-title]'));
      await s.history('back');
      assert.equal(s.address, '/portfolio/projects/');
      assert.equal(s.document.activeElement, s.find(`[data-work-project="${project.slug}"]`));
    }
  } finally { await s.close(); }
});

test('Back, Forward, and repeated Close restore grid scroll and opener focus', async () => {
  const s = await scene('/projects/', { previous: '/about/#interests' });
  try {
    await s.scrollTo(620);
    s.click('[data-work-project="rag-chatbot"]'); await s.flush();
    assert.equal(s.y, 0);
    const entries = s.window.history.length;
    await s.scrollTo(370);
    await s.history('back');
    assert.equal(s.address, '/projects/');
    assert.equal(s.y, 620);
    assert.equal(s.document.activeElement, s.find('[data-work-project="rag-chatbot"]'));
    await s.scrollTo(815);
    await s.history('forward');
    assert.equal(s.address, '/projects/#project=rag-chatbot');
    assert.equal(s.y, 370);
    s.click('[data-work-close]'); s.click('[data-work-close]');
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.address, '/projects/');
    assert.equal(s.y, 815);
    assert.equal(s.document.activeElement, s.find('[data-work-project="rag-chatbot"]'));
    assert.equal(s.window.history.length, entries);
    assert.equal(s.window.history.state.retained, true);
  } finally { await s.close(); }
});

test('direct legacy article entry closes to Work without leaving for the previous page', async () => {
  const s = await scene('/projects/#slide=afterimage', { previous: '/about/#interests' });
  try {
    const entries = s.window.history.length;
    assert.equal(s.address, '/projects/#project=2d-lightning-simulation');
    s.click('[data-work-index]'); await s.flush();
    assert.equal(s.address, '/projects/');
    assert.equal(s.window.history.length, entries);
    assert.equal(s.y, 0);
    assert.equal(s.document.activeElement, s.find('[data-work-project="2d-lightning-simulation"]'));
    assert.equal(s.window.history.state.retained, true);
  } finally { await s.close(); }
});

test('legacy Art project entry uses the placeholder and Escape returns to Work', async () => {
  const s = await scene('/projects/#project=art');
  try {
    assert.equal(s.find('[data-detail-title]').textContent, 'Art');
    assert.equal(s.document.documentElement.hasAttribute('data-portfolio-entry-pending'), false);
    const article = s.find('[data-work-article]');
    assert.equal(article.querySelectorAll('p').length, 1);
    assert.match(article.querySelector('p').textContent, /^Lorem ipsum dolor sit amet,/);
    assert.equal(article.querySelector('img, dialog, .case-study-section, .project-footnote'), null);
    s.document.dispatchEvent(new s.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await s.flush();
    assert.equal(s.address, '/projects/');
    assert.equal(s.document.activeElement, s.find('[data-work-heading]'));
    assert.equal(s.root.style.getPropertyValue('--accent'), '#123456');
    assert.equal(s.root.style.getPropertyValue('--ink'), '#fedcba');
  } finally { await s.close(); }
});

test('modified project clicks and About/Resume links keep native navigation', async () => {
  const s = await scene();
  try {
    assert.equal(s.click('[data-work-project="rag-chatbot"]', { ctrlKey: true }).defaultPrevented, false);
    assert.equal(s.click('#about').defaultPrevented, false);
    assert.equal(s.click('#resume').defaultPrevented, false);
    assert.equal(s.find('#about').getAttribute('href'), '/about/#interests');
    assert.equal(s.find('#resume').getAttribute('href'), '/resume/');
  } finally { await s.close(); }
});

test('standalone preview uses the address bridge and follows history without extra writes', async () => {
  const s = await scene('/projects/', { preview: true });
  try {
    await s.scrollTo(540);
    s.click('[data-work-project="rag-chatbot"]'); await s.flush();
    const writes = s.previewWrites;
    await s.history('back');
    assert.equal(s.address, '/projects/');
    assert.equal(s.y, 540);
    assert.equal(s.previewWrites, writes);
    await s.history('forward');
    assert.equal(s.address, '/projects/#project=rag-chatbot');
    assert.equal(s.previewWrites, writes);
    s.click('[data-work-close]');
    await new Promise(resolve => setTimeout(resolve, 0)); await s.flush();
    assert.equal(s.address, '/projects/');
    assert.equal(s.y, 540);
    s.window.__PORTFOLIO_PREVIEW_ADDRESS__ = '/about/';
    const writesBeforeUnmount = s.previewWrites;
    s.unmount();
    assert.equal(s.previewWrites, writesBeforeUnmount, 'cleanup must not overwrite a new native-page address');
  } finally { await s.close(); }
});

test('initial legacy Links preview redirect waits for mount to return and clears entry concealment', async () => {
  const s = await scene('/projects/#links', { preview: true });
  try {
    assert.equal(s.address, '/art/#links');
    assert.equal(s.redirectDuringMount, false);
    assert.equal(s.document.documentElement.hasAttribute('data-portfolio-entry-pending'), false);
  } finally { await s.close(); }
});

for (const preview of [false, true]) {
  test(`skip link focuses current content without changing article route or history${preview ? ' in preview' : ''}`, async () => {
    const s = await scene('/projects/', { preview });
    try {
      await s.scrollTo(300);
      assert.equal(s.click('.serif-skip-link').defaultPrevented, true);
      assert.equal(s.document.activeElement, s.find('[data-work-heading]'));
      assert.equal(s.scrolledTarget, s.find('[data-work-heading]'));
      assert.equal(s.address, '/projects/');
      s.click('[data-work-project="rag-chatbot"]'); await s.flush();
      await s.scrollTo(900);
      const address = s.address;
      const entries = s.window.history.length;
      const state = structuredClone(s.window.history.state);
      const writes = s.previewWrites;
      assert.equal(s.click('.serif-skip-link').defaultPrevented, true);
      await s.flush();
      assert.equal(s.find('[data-work-article]').hidden, false);
      assert.equal(s.document.activeElement, s.find('[data-detail-title]'));
      assert.equal(s.scrolledTarget, s.find('[data-detail-title]'));
      assert.equal(s.y, 0);
      assert.equal(s.address, address);
      assert.equal(s.window.history.length, entries);
      assert.deepEqual(s.window.history.state, state);
      assert.equal(s.previewWrites, writes);
    } finally { await s.close(); }
  });
}

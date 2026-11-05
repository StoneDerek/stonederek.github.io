import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mountSerifNavigation } from '../src/scripts/serif-navigation.js';

function scene({ open = false, mobile: narrow = true } = {}) {
  const window = new Window({ url: 'https://portfolio.example/art/', settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  const { document } = window;
  document.body.innerHTML = `<div class="serif-site" style="padding:20px 24px 32px">
    <a class="serif-skip-link" href="#content">Skip to content</a>
    <header class="serif-masthead"><span>Derek_Stone</span><details data-serif-menu${open ? ' open' : ''}>
      <summary>Menu</summary><div data-serif-menu-backdrop aria-hidden="true"></div>
      <div class="serif-mobile-menu-panel"><nav class="serif-navigation-mobile">
        <a href="/">Home</a><a href="/projects/">Work</a><a href="/about/">About</a>
        <a href="/art/" aria-current="page">Art</a><a href="/resume.pdf">Resume</a><a href="https://example.com">LinkedIn</a>
      </nav></div></details></header>
    <nav class="serif-navigation-desktop"><a href="/projects/">Work</a><a href="/art/" aria-current="page">Art</a></nav>
    <main id="content"><a href="#note">A prose link</a></main><footer><a href="mailto:test@example.com">Contact</a></footer>
  </div>`;
  const mobile = Object.assign(new window.EventTarget(), { matches: narrow });
  window.matchMedia = query => query.includes('max-width') ? mobile : Object.assign(new window.EventTarget(), { matches: !mobile.matches });
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  const site = document.querySelector('.serif-site');
  site.getBoundingClientRect = () => ({ left: 0, right: 390, top: 0, bottom: 800, width: 390, height: 800 });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 });
  const menu = site.querySelector('[data-serif-menu]'), summary = menu.querySelector('summary');
  const links = [...menu.querySelectorAll('a')], main = site.querySelector('main'), footer = site.querySelector('footer');
  let release;
  const mount = () => { release = mountSerifNavigation(document); };
  const toggle = value => { menu.open = value; menu.dispatchEvent(new window.Event('toggle')); };
  const key = (value, node = document.activeElement, shiftKey = false) => {
    const event = new window.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
    node.dispatchEvent(event); return event;
  };
  const click = node => {
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    node.dispatchEvent(event); return event;
  };
  return { window, document, site, menu, summary, links, main, footer, mobile, mount, toggle, key, click,
    release: () => release?.(), async close() { release?.(); await window.happyDOM.close(); } };
}

test('opening the menu makes background content inert and restores prior states on close', async () => {
  const s = scene();
  try {
    s.footer.inert = true;
    s.mount();
    s.main.querySelector('a').focus();
    s.toggle(true);
    assert.equal(s.main.inert, true);
    assert.equal(s.footer.inert, true);
    assert.equal(s.site.querySelector('.serif-skip-link').inert, true);
    assert.equal(s.site.querySelector('.serif-navigation-desktop').inert, true);
    assert.equal(s.menu.closest('header').inert, false);
    assert.equal(s.document.activeElement, s.summary);
    s.toggle(false);
    assert.equal(s.main.inert, false);
    assert.equal(s.footer.inert, true, 'a pre-existing inert state is retained');
    assert.equal(s.site.querySelector('.serif-skip-link').inert, false);
    s.toggle(true); s.toggle(false); s.toggle(true);
    assert.equal(s.main.inert, true);
    s.toggle(false);
    assert.equal(s.main.inert, false, 'rapid state changes do not overwrite the original state');
  } finally { await s.close(); }
});

test('Tab boundaries stay in the menu and Escape restores the disclosure focus', async () => {
  const s = scene();
  try {
    s.mount(); s.toggle(true);
    s.summary.focus();
    assert.equal(s.key('Tab', s.summary, true).defaultPrevented, true);
    assert.equal(s.document.activeElement, s.links.at(-1));
    assert.equal(s.key('Tab').defaultPrevented, true);
    assert.equal(s.document.activeElement, s.summary);
    s.links[2].focus();
    assert.equal(s.key('Tab').defaultPrevented, false, 'normal movement between menu links stays native');
    assert.equal(s.key('Escape').defaultPrevented, true);
    assert.equal(s.menu.open, false);
    assert.equal(s.main.inert, false);
    assert.equal(s.document.activeElement, s.summary);
  } finally { await s.close(); }
});

test('backdrop dismissal restores focus while link activation keeps its native navigation behavior', async () => {
  const s = scene();
  try {
    s.mount(); s.toggle(true); s.links[1].focus();
    s.click(s.menu.querySelector('.serif-mobile-menu-panel'));
    assert.equal(s.menu.open, true, 'clicking panel space does not dismiss the menu');
    s.click(s.menu.querySelector('[data-serif-menu-backdrop]'));
    assert.equal(s.menu.open, false);
    assert.equal(s.document.activeElement, s.summary);
    s.toggle(true); s.links[1].focus();
    assert.equal(s.click(s.links[1]).defaultPrevented, false);
    assert.equal(s.menu.open, false);
    assert.notEqual(s.document.activeElement, s.summary, 'a navigation activation does not force focus back to the opener');
    assert.equal(s.main.inert, false);
  } finally { await s.close(); }
});

test('desktop resize closes the menu and moves menu focus to the corresponding desktop link', async () => {
  const s = scene();
  try {
    s.mount(); s.toggle(true); s.links[1].focus();
    s.mobile.matches = false;
    s.mobile.dispatchEvent(new s.window.Event('change'));
    assert.equal(s.menu.open, false);
    assert.equal(s.main.inert, false);
    assert.equal(s.document.activeElement, s.site.querySelector('.serif-navigation-desktop a[href="/projects/"]'));
    assert.equal(s.site.style.getPropertyValue('--layout-viewport-width'), '390px');
    assert.equal(s.site.style.getPropertyValue('--site-content-left'), '24px');
    assert.equal(s.site.style.getPropertyValue('--site-content-right'), '24px');
    assert.equal(s.site.style.getPropertyValue('--site-content-top'), '20px');
  } finally { await s.close(); }
});

test('initial open state is synchronized and cleanup restores background without leaving active handlers', async () => {
  const s = scene({ open: true });
  try {
    s.mount();
    assert.equal(s.main.inert, true);
    s.release(); s.release();
    assert.equal(s.menu.open, false);
    assert.equal(s.main.inert, false);
    s.toggle(true);
    assert.equal(s.main.inert, false, 'toggle handling is removed on cleanup');
    assert.equal(s.key('Escape', s.summary).defaultPrevented, false);
    assert.equal(s.menu.open, true);
  } finally { await s.close(); }
  const desktop = scene({ open: true, mobile: false });
  try {
    desktop.mount();
    assert.equal(desktop.menu.open, false, 'desktop entry cannot retain a mobile overlay');
    assert.equal(desktop.main.inert, false);
  } finally { await desktop.close(); }
});

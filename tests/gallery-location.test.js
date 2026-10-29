import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { galleryPanels, firstProjectPanel } from '../src/data/gallery-panels.js';
import { galleryAddress, resolveGalleryLocation, sectionForPanel, previewAddress, previewHash } from '../src/scripts/gallery-location.js';

const projects = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
const panels = galleryPanels(projects);

test('Home and About are content panels before the existing unmodified projects', () => {
  assert.equal(firstProjectPanel, 2);
  assert.deepEqual(panels.slice(0, 2).map(panel => [panel.kind, panel.title]), [['home', 'Home'], ['about', 'About']]);
  assert.equal(panels.length, projects.length + 2);
  panels.slice(2).forEach((panel, index) => assert.deepEqual(panel, { ...projects[index], kind: 'project' }));
});

for (const base of ['/', '/portfolio/']) {
  test(`every gallery panel has a reversible direct URL under ${base}`, () => {
    for (let panel = 0; panel <= panels.length; panel++) {
      const address = galleryAddress(panel, panels, { base });
      assert.ok(address.startsWith(base));
      assert.deepEqual(resolveGalleryLocation(address, panels), { panel, article: null, anchor: '' });
      assert.equal(sectionForPanel(panel), panel === 0 ? 'home' : panel === 1 ? 'about' : 'projects');
    }
    assert.equal(galleryAddress(0, panels, { base }), base);
    assert.equal(galleryAddress(1, panels, { base }), `${base}about/`);
    assert.equal(galleryAddress(2, panels, { base }), `${base}projects/`);
  });
  test(`every article URL keeps its own return slide under ${base}`, () => {
    for (let panel = firstProjectPanel; panel < panels.length; panel++) {
      const address = galleryAddress(panel, panels, { base, article: true });
      assert.deepEqual(resolveGalleryLocation(address, panels), { panel, article: panel, anchor: '' });
    }
  });
}

test('Home and About cannot accidentally open as project articles', () => {
  for (const panel of [0, 1, panels.length]) assert.throws(() => galleryAddress(panel, panels, { article: true }), TypeError);
  for (const hash of ['project=home', 'project=about', 'project=missing', 'slide=home', 'slide=about', 'slide=missing']) {
    assert.deepEqual(resolveGalleryLocation(`/projects/#${hash}`, panels), { panel: 2, article: null, anchor: '' });
  }
});

test('native and encoded profile anchors resolve without confusing articles', () => {
  assert.deepEqual(resolveGalleryLocation('/about/#outside-engineering', panels), { panel: 1, article: null, anchor: 'outside-engineering' });
  assert.deepEqual(resolveGalleryLocation('/portfolio/about/index.html#hello%20world', panels), { panel: 1, article: null, anchor: 'hello world' });
  assert.deepEqual(resolveGalleryLocation('/#home-title', panels), { panel: 0, article: null, anchor: 'home-title' });
  assert.equal(galleryAddress(1, panels, { anchor: 'hello world' }), '/about/#hello%20world');
  assert.equal(resolveGalleryLocation('/about/#%E0%A4%A', panels).anchor, '');
});

test('legacy index URLs and unknown project fragments safely resolve', () => {
  assert.equal(resolveGalleryLocation('/about/index.html', panels).panel, 1);
  assert.equal(resolveGalleryLocation('/projects/index.html', panels).panel, 2);
  assert.equal(resolveGalleryLocation('/portfolio/index.html', panels).panel, 0);
  assert.equal(resolveGalleryLocation('/projects/#links', panels).panel, panels.length);
  assert.equal(resolveGalleryLocation('/projects/#gallery', panels).panel, 2);
});

test('previous project names open the corresponding current cover and article', () => {
  for (const [old, current] of [
    ['signal-studies', 'acoustic-drone-detection'],
    ['soft-machines', 'academic-advising'],
    ['afterimage', '2d-lightning-simulation']
  ]) {
    const panel = panels.findIndex(project => project.slug === current);
    assert.ok(panel >= firstProjectPanel);
    assert.deepEqual(resolveGalleryLocation(`/projects/#slide=${old}`, panels), { panel, article: null, anchor: '' });
    assert.deepEqual(resolveGalleryLocation(`/projects/#project=${old}`, panels), { panel, article: panel, anchor: '' });
    assert.equal(galleryAddress(panel, panels, { article: true }), `/projects/#project=${current}`);
  }
});

test('gallery bounds clamp to Home and Links, not a nonexistent project', () => {
  assert.equal(galleryAddress(-20, panels), '/');
  assert.equal(galleryAddress(999, panels), '/projects/#links');
});

test('offline addresses preserve every panel, article, and profile anchor', () => {
  const addresses = [galleryAddress(1, panels, { anchor: 'interests' })];
  for (let panel = 0; panel <= panels.length; panel++) addresses.push(galleryAddress(panel, panels));
  for (let panel = 2; panel < panels.length; panel++) addresses.push(galleryAddress(panel, panels, { article: true }));
  for (const address of addresses) assert.equal(previewAddress(previewHash(address)), address);
  assert.equal(previewAddress('#missing'), '/');
  assert.equal(previewAddress(''), '/');
});

test('only one shared gallery component serves all three direct entry routes', async () => {
  for (const [page, section] of [['index', 'home'], ['about', 'about'], ['projects', 'projects']]) {
    const source = await readFile(new URL(`../src/pages/${page}.astro`, import.meta.url), 'utf8');
    assert.match(source, /import Portfolio from/);
    assert.ok(source.includes(`<Portfolio section="${section}" />`));
  }
  const layout = await readFile(new URL('../src/layouts/Layout.astro', import.meta.url), 'utf8');
  const header = await readFile(new URL('../src/components/SiteHeader.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /ClientRouter|section-navigation/);
  assert.doesNotMatch(header, /page-links/);
});

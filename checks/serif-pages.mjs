import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Window } from 'happy-dom';

// Read real built pages. These checks cover content, destinations and semantic
// structure; they do not establish browser geometry or physical-device feel.
async function page(entry, run) {
  const window = new Window({ url: `https://stonederek.github.io/${entry}`, settings: {
    disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true
  } });
  try {
    window.document.write(await readFile(new URL(`../dist/${entry}index.html`, import.meta.url), 'utf8'));
    await run(window.document, window);
  } finally { await window.happyDOM.close(); }
}

test('native serif pages provide matching desktop/mobile destinations and useful landmarks', async () => {
  for (const [entry, active] of [['', 'Home'], ['projects/', 'Work'], ['about/', 'About'], ['resume/', 'Resume']]) {
    await page(entry, async doc => {
      assert.ok(doc.querySelector('.serif-site'));
      assert.equal(doc.querySelectorAll('main').length, 1);
      assert.equal(doc.querySelector('#portfolio'), null, 'native pages do not mount the gallery track');
      assert.ok(doc.querySelector('main h1').textContent.trim());
      const navs = [...doc.querySelectorAll('nav[aria-label="Main navigation"]')];
      assert.equal(navs.length, 2);
      const destinations = nav => [...nav.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]);
      assert.deepEqual(destinations(navs[0]), destinations(navs[1]));
      assert.deepEqual(destinations(navs[0]).map(([label]) => label), ['Home', 'Work', 'About', 'Art', 'Resume', 'LinkedIn']);
      for (const nav of navs) assert.equal(nav.querySelector('[aria-current="page"]').textContent, active);
      assert.ok(doc.querySelector('details[data-serif-menu] > summary'));
      const skip = doc.querySelector('.serif-skip-link');
      assert.ok(doc.getElementById(skip.getAttribute('href').slice(1)));
      assert.equal(doc.querySelector('.serif-identity').textContent, 'Derek Stone');
      assert.equal(doc.querySelector('.serif-footer a[href*="#links"]'), null, 'mirror puzzle remains a hidden discovery in Art');
      assert.equal(doc.querySelector('meta[name="color-scheme"]').content, 'only light');
    });
  }
});

test('Work contains exactly the three current projects with the RAG hierarchy and real article targets', async () => {
  await page('projects/', async doc => {
    const root = doc.querySelector('[data-work-root]');
    assert.ok(root);
    const cards = [...doc.querySelectorAll('[data-work-project]')];
    assert.deepEqual(cards.map(card => card.dataset.workProject), ['acoustic-drone-detection', 'rag-chatbot', '2d-lightning-simulation']);
    assert.deepEqual(cards.map(card => card.querySelector('h2').textContent), ['Acoustic Drone Detection', 'RAG Chatbot', '2D Lightning Simulation']);
    assert.equal(cards[1].querySelector('.work-project-method').textContent, 'for Academic Advising');
    for (const card of cards) {
      assert.equal(card.getAttribute('href'), `/projects/#project=${card.dataset.workProject}`);
      const image = card.querySelector('img');
      assert.ok(image.alt && image.width > 0 && image.height > 0);
      await access(new URL(`../dist${image.getAttribute('src')}`, import.meta.url));
    }
    assert.equal(doc.querySelector('[data-work-grid]').hidden, false);
    assert.equal(doc.querySelector('[data-work-article]').hidden, true);
    assert.ok(doc.querySelector('[data-work-close]'));
    assert.ok(doc.querySelector('dialog[data-image-viewer] [data-image-zoom]'));
    assert.ok(doc.querySelector('[data-work-heading][tabindex="-1"]'));
    const data = JSON.parse(doc.querySelector('#work-data').textContent);
    assert.equal(data.length, 4);
    assert.equal(data.filter(item => item.slug === 'art').length, 1, 'legacy Art article links retain their original content');
    assert.ok(data[1].legacySlugs.includes('soft-machines'));
  });
});

test('Home and About preserve the supplied introduction, photo and established anchors', async () => {
  await page('', doc => {
    assert.equal(doc.querySelector('#home-title').textContent, 'Derek Stone');
    assert.equal(doc.querySelector('.introduction-lead').textContent, 'Hi, I’m Derek.');
    assert.match(doc.querySelector('.introduction-prose').textContent, /Electrical Engineering student/);
    assert.ok(doc.querySelector('.introduction-prose a[href="https://www.rose-hulman.edu/"]'));
    const image = doc.querySelector('.introduction-photo img');
    assert.equal(image.getAttribute('src'), '/art/home/climbing.webp');
    assert.equal(image.width / image.height, 1536 / 2048);
    assert.equal(image.loading, 'eager');
    assert.ok(doc.querySelector('[data-home-entry]'));
  });
  await page('about/', doc => {
    assert.ok(doc.getElementById('interests'));
    assert.ok(doc.querySelector('.about-contents a[href="#interests"]'));
  });
});

test('the Art entry retains the original gallery, five photographs, viewer and mirror puzzle', async () => {
  await page('art/', doc => {
    const root = doc.querySelector('#portfolio');
    const panels = JSON.parse(doc.querySelector('#portfolio-data').textContent);
    assert.equal(panels[Number(root.dataset.initialPanel)].slug, 'art');
    const art = panels.find(item => item.slug === 'art');
    assert.equal(art.caseStudy.sections.flatMap(section => section.media || []).length, 5);
    assert.ok(root.querySelector('dialog[data-image-viewer]'));
    assert.ok(root.querySelector('[data-gallery-end] [data-laser-experiment]'));
  });
});

test('all built native destinations, IDs, local assets and accessibility references resolve', async () => {
  for (const entry of ['', 'about/', 'projects/', 'resume/', 'art/']) {
    await page(entry, async (doc, window) => {
      const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
      assert.equal(new Set(ids).size, ids.length, `Duplicate IDs on ${entry || 'Home'}`);
      for (const node of doc.querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
        for (const attr of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
          for (const id of (node.getAttribute(attr) || '').split(/\s+/).filter(Boolean)) {
            assert.ok(doc.getElementById(id), `Missing ${attr} ${id} on ${entry}`);
          }
        }
      }
      for (const node of doc.querySelectorAll('[src], a[href], link[href]')) {
        const raw = node.getAttribute('src') || node.getAttribute('href');
        const url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin) continue;
        const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
        await access(new URL(`../dist${path}`, import.meta.url));
      }
    });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { Window } from 'happy-dom';
const originalArt = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8')).find(project => project.slug === 'art');

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
  for (const [entry, active] of [['', 'Home'], ['projects/', 'Work'], ['about/', 'About'], ['art/', 'Art']]) {
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
      for (const link of doc.querySelectorAll('[data-resume-link]')) {
        assert.equal(new URL(link.href).pathname, '/resume.pdf', 'Resume opens the PDF directly');
      }
      const mobileMenu = doc.querySelector('details[data-serif-menu]');
      assert.ok(mobileMenu?.querySelector(':scope > summary'));
      assert.ok(mobileMenu.querySelector('[data-serif-menu-backdrop]'));
      assert.ok(mobileMenu.querySelector('.serif-mobile-menu-panel > nav'));
      const skip = doc.querySelector('.serif-skip-link');
      assert.ok(doc.getElementById(skip.getAttribute('href').slice(1)));
      const brand = doc.querySelector('.serif-brand');
      assert.equal(brand.querySelector('.serif-identity').textContent, 'Derek_Stone');
      assert.equal(brand.querySelector('.serif-context')?.textContent || '', active === 'Home' ? '' : `/${active}`);
      const updated = doc.querySelector('.serif-footer time[data-publication-date]');
      assert.ok(updated);
      assert.ok(Number.isFinite(new Date(updated.dateTime).getTime()));
      assert.equal(updated.getAttribute('tabindex'), '0');
      assert.equal(updated.getAttribute('aria-describedby'), null);
      assert.equal(doc.querySelector('.publication-tooltip, [role="tooltip"]'), null);
      assert.equal(doc.querySelector('.serif-footer a[href*="#links"]'), null, 'mirror puzzle remains a hidden discovery in Art');
      assert.equal(doc.querySelector('meta[name="color-scheme"]').content, 'light dark');
      assert.equal(doc.documentElement.hasAttribute('data-appearance-enabled'), true);
      assert.equal(doc.querySelector('nav [data-theme-control], main [data-theme-control]'), null);
      const appearance = [...doc.querySelectorAll('[data-theme-control]')];
      assert.equal(appearance.length, 1);
      assert.ok(appearance[0].matches('.serif-footer button[data-theme-switch]'));
      assert.equal(appearance[0].getAttribute('role'), 'switch');
      assert.equal(appearance[0].getAttribute('aria-label'), 'Dark mode');
      assert.equal(appearance[0].querySelector('[data-theme-action]').textContent, 'Dark mode');
      assert.equal(doc.querySelector('[data-theme-status], [data-theme-system]'), null);
    });
  }
});

test('Work contains exactly the three current projects with the RAG hierarchy and real article targets', async () => {
  await page('projects/', async doc => {
    const root = doc.querySelector('[data-work-root]');
    assert.ok(root);
    const cards = [...doc.querySelectorAll('[data-work-project]')];
    assert.deepEqual(cards.map(card => card.dataset.workProject), ['acoustic-drone-detection', 'rag-chatbot', '2d-lightning-simulation']);
    assert.deepEqual(cards.map(card => card.querySelector('h2').textContent), ['Untitled #1', 'Untitled #2', 'Untitled #3']);
    assert.deepEqual(cards.map(card => card.querySelector('.work-project-method').textContent), ['Acoustic Drone Detection with CNN Spectrogram Analysis', 'RAG Chatbot informed Academic Advising', '2D Lightning Simulation of a Probabilistic Potential Model']);
    for (const card of cards) {
      assert.equal(card.getAttribute('href'), `/projects/#project=${card.dataset.workProject}`);
      const image = card.querySelector('img');
      assert.ok(image.alt && image.width > 0 && image.height > 0);
      await access(new URL(`../dist${image.getAttribute('src')}`, import.meta.url));
    }
    assert.equal(doc.querySelector('[data-work-grid]').hidden, false);
    assert.equal(doc.querySelector('[data-work-article]').hidden, true);
    assert.ok(doc.querySelector('[data-work-close]'));
    const article = doc.querySelector('[data-work-article]');
    assert.equal(article.querySelectorAll('p').length, 1);
    assert.match(article.querySelector('p').textContent, /^Lorem ipsum dolor sit amet,/);
    assert.ok(article.querySelector('[data-detail-title]').classList.contains('sr-only'));
    assert.equal(article.querySelector('img, dialog, .project-view-meta, .project-view-number, .project-story, .project-case-study'), null);
    assert.equal(doc.querySelector('[data-image-viewer]'), null);
    assert.ok(doc.querySelector('[data-work-heading][tabindex="-1"]'));
    const data = JSON.parse(doc.querySelector('#work-data').textContent);
    assert.equal(data.length, 4);
    assert.equal(data.filter(item => item.slug === 'art').length, 1, 'legacy Art project links remain recognized');
    assert.ok(data.every(item => Object.keys(item).every(key => ['slug', 'legacySlugs', 'title'].includes(key))), 'Work embeds routing metadata without the former article content');
    assert.ok(data[1].legacySlugs.includes('soft-machines'));
    const coming = doc.querySelector('.work-coming-soon');
    assert.match(coming?.textContent, /More coming soon/);
    assert.ok(coming.querySelector('pre').textContent.trim());
    assert.equal(coming.querySelector('a, button, [tabindex]'), null, 'the forthcoming item does not promise an article');
  });
});

test('Home preserves its introduction and photo while About contains only one placeholder paragraph', async () => {
  await page('', doc => {
    assert.equal(doc.querySelector('#home-title').textContent, 'Derek Stone');
    assert.ok(doc.querySelector('#home-title').classList.contains('native-profile-title'));
    assert.equal(doc.querySelector('.introduction-lead').textContent, 'Hi, I’m Derek.');
    assert.match(doc.querySelector('.introduction-prose').textContent, /Electrical Engineering student/);
    assert.ok(doc.querySelector('.introduction-prose a[href="https://www.rose-hulman.edu/"]'));
    const image = doc.querySelector('.introduction-photo img');
    assert.equal(image.getAttribute('src'), '/art/home/climbing.webp');
    assert.equal(image.width / image.height, 1536 / 2048);
    assert.equal(image.loading, 'eager');
    assert.equal(doc.querySelector('[data-home-entry], .has-entry-motion, main script'), null, 'native Home displays its content without an entrance sequence');
    const explore = [...doc.querySelectorAll('main a[href="/projects/"]')];
    assert.equal(explore.length, 1);
    assert.equal(explore[0].getAttribute('role'), null);
  });
  await page('about/', async doc => {
    assert.ok(doc.querySelector('#about-title').classList.contains('native-profile-title'));
    assert.equal(doc.querySelector('#about-title').getAttribute('aria-label'), 'About');
    assert.ok(doc.getElementById('interests'));
    assert.equal(doc.querySelectorAll('main p').length, 1);
    assert.match(doc.querySelector('main p').textContent, /^Lorem ipsum dolor sit amet,/);
    assert.equal(doc.querySelector('main img, main a, .about-heading, .about-contents, .about-story section, .about-story h2'), null);
    await page('projects/', work => {
      assert.equal(doc.querySelector('main p').textContent, work.querySelector('[data-work-article] p').textContent);
    });
  });
});

test('Art contains only five original photographs, image thumbnails and its selected artwork title', async () => {
  await page('art/', doc => {
    const root = doc.querySelector('[data-art-root]');
    assert.ok(root);
    assert.equal(doc.querySelector('#portfolio, [data-gallery-track], [data-work-project]'), null);
    const stage = root.querySelector('[data-art-stage]');
    const details = root.querySelector('[data-art-details]');
    assert.ok(stage && details);
    assert.ok(stage.querySelector('[data-art-track]'));
    assert.ok(root.querySelector('[data-art-rail]'));
    assert.equal(root.querySelector('[data-art-title]').textContent, 'Untitled #1');
    assert.equal(root.querySelector('.art-caption, [data-art-step], [data-art-count]'), null);
    assert.ok(root.closest('main'), 'the gallery belongs to the normal page content');
    assert.equal(stage.contains(details), false, 'original artwork prose stays below the gallery');
    const items = [...root.querySelectorAll('[data-art-item]')];
    const choices = [...root.querySelectorAll('[data-art-select]')];
    assert.equal(items.length, 5);
    assert.deepEqual(choices.map(choice => choice.dataset.artSelect), ['0', '1', '2', '3', '4']);
    assert.ok(choices.every(choice => choice.tagName === 'BUTTON'));
    assert.ok(choices.every(choice => choice.textContent.trim() === ''), 'thumbnails do not add number labels');
    const paths = ['stellers-jay', 'broken-line-chicken', 'ink-chicken', 'bird-stamp', 'watercolors'];
    for (const [index, item] of items.entries()) {
      assert.ok(item.querySelector(`img[src="/art/collection/${paths[index]}.webp"]`));
      assert.equal(item.hidden, false, 'adjacent artwork stays in the continuous gallery track');
      assert.equal(item.getAttribute('aria-hidden'), String(index !== 0));
    }
    assert.equal(choices.filter(choice => choice.getAttribute('aria-current') === 'true').length, 1);
    assert.equal(root.dataset.artIndex, '0');
    const art = JSON.parse(root.querySelector('#art-data').textContent);
    assert.equal(art.slug, 'art');
    assert.equal(art.caseStudy.sections.flatMap(section => section.media || []).length, 5);
    assert.equal(art.description, originalArt.description);
    assert.equal(art.note, originalArt.note);
    assert.deepEqual(art.caseStudy.sections.map(section => section.title), ['01', '02', '03', '04', '05']);
    assert.deepEqual(art.caseStudy.sections.map(section => section.paragraphs), originalArt.caseStudy.sections.map(section => section.paragraphs));
    assert.deepEqual(art.caseStudy.footnotes.filter(note => note.number > 0), originalArt.caseStudy.footnotes.filter(note => note.number > 0));
    const puzzle = doc.querySelector('[data-art-puzzle]');
    assert.ok(puzzle?.querySelector('[data-laser-experiment]'));
    assert.equal(puzzle.hidden, true);
    assert.equal(stage.contains(puzzle), false, 'the hidden puzzle is not an artwork slide');
  });
});

test('the compatibility Resume route redirects immediately to the same directly linked PDF', async () => {
  let destination;
  await page('', doc => { destination = doc.querySelector('[data-resume-link]').getAttribute('href'); });
  await page('resume/', async doc => {
    assert.equal(doc.querySelector('.serif-site'), null, 'a PDF link does not display an intermediate shell');
    const refresh = [...doc.querySelectorAll('meta[http-equiv]')].find(meta => meta.httpEquiv.toLowerCase() === 'refresh');
    assert.ok(refresh);
    assert.equal(refresh.content.replace(/^0;\s*url=/i, ''), destination);
    assert.ok([...doc.querySelectorAll('a[href]')].some(link => link.getAttribute('href') === destination));
    await access(new URL('../dist/resume.pdf', import.meta.url));
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

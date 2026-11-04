import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveWorkLocation, workAddress, workLinksAddress } from '../src/scripts/work-location.js';

const projects = JSON.parse(await readFile(new URL('../src/data/projects.json', import.meta.url), 'utf8'));

for (const base of ['/', '/portfolio/']) {
  test(`Work has a grid route and canonical project routes under ${base}`, () => {
    assert.deepEqual(resolveWorkLocation(`${base}projects/`, projects, { base }), { view: 'grid', slug: null });
    assert.deepEqual(resolveWorkLocation(`${base}projects/index.html`, projects, { base }), { view: 'grid', slug: null });
    assert.equal(workAddress(null, { base }), `${base}projects/`);
    for (const project of projects) {
      for (const slug of [project.slug, ...(project.legacySlugs || [])]) {
        for (const key of ['project', 'slide']) {
          assert.deepEqual(resolveWorkLocation(`${base}projects/#${key}=${slug}`, projects, { base }),
            { view: 'article', slug: project.slug });
        }
      }
      assert.equal(workAddress(project.slug, { base }), `${base}projects/#project=${project.slug}`);
    }
  });

  test(`Work leaves About anchors, Resume, and Art routes outside its scope under ${base}`, () => {
    for (const address of [`${base}about/#interests`, `${base}resume/`, `${base}art/`, `${base}#project=art`]) {
      assert.equal(resolveWorkLocation(address, projects, { base }), null, address);
    }
    assert.equal(workLinksAddress({ base }), `${base}art/#links`);
  });
}

test('old Art links still identify the complete Art article', () => {
  for (const key of ['project', 'slide']) {
    assert.deepEqual(resolveWorkLocation(`/projects/#${key}=art`, projects), { view: 'article', slug: 'art' });
  }
  assert.equal(projects.find(project => project.slug === 'art').caseStudy.sections.length, 5);
});

test('invalid fragments return to Work and cannot select an unrelated section', () => {
  for (const hash of ['gallery', 'project=missing', 'slide=missing', 'project=home', 'slide=about', '%E0%A4%A']) {
    assert.deepEqual(resolveWorkLocation(`/projects/#${hash}`, projects), { view: 'grid', slug: null }, hash);
  }
  assert.deepEqual(resolveWorkLocation('/projects/#project=missing&slide=afterimage', projects),
    { view: 'article', slug: '2d-lightning-simulation' });
});

test('legacy Links still reaches the retained Art gallery puzzle', () => {
  assert.deepEqual(resolveWorkLocation('/projects/#links', projects), { view: 'legacy-links', slug: null });
  assert.deepEqual(resolveWorkLocation('/projects/#links&project=art', projects), { view: 'article', slug: 'art' });
});

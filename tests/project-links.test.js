import test from 'node:test';
import assert from 'node:assert/strict';
import { projectIndexFromHash, projectSectionEntry } from '../src/scripts/project-links.js';

const projects = [{ slug: 'first-project' }, { slug: 'second-project' }, { slug: 'last-project' }];
const address = path => new URL(path, 'https://example.com/');

test('Home and About enter the exact requested project, including a hosted base path', () => {
  for (const from of ['/', '/about/', '/portfolio/', '/portfolio/about/']) {
    assert.equal(projectSectionEntry(address(from), address('/portfolio/projects/#project=last-project'), projects), 2);
    assert.equal(projectSectionEntry(address(from), address('/portfolio/projects/#project=first-project'), projects), 0);
  }
});

test('gallery links, ordinary anchors, and unknown project slugs remain gallery navigation', () => {
  for (const target of ['/projects/', '/projects/#gallery', '/projects/#project=', '/projects/#project=missing']) {
    assert.equal(projectSectionEntry(address('/about/'), address(target), projects), -1);
  }
  assert.equal(projectSectionEntry(address('/projects/'), address('/projects/#project=last-project'), projects), -1);
  assert.equal(projectSectionEntry(address('/about/'), address('/#project=last-project'), projects), -1);
});

test('project fragments are parsed as URL parameters rather than substring matches', () => {
  assert.equal(projectIndexFromHash('#other=first-project&project=second-project', projects), 1);
  assert.equal(projectIndexFromHash('#project=last%2Dproject', projects), 2);
  assert.equal(projectIndexFromHash('#other=project=last-project', projects), -1);
});

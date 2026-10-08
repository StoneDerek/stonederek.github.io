import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationLabel } from '../src/scripts/publication-label.js';

test('updated labels use the publication calendar rather than elapsed 24-hour periods', () => {
  // UTC has crossed midnight, but the published version is still from today in New York.
  assert.equal(publicationLabel('2026-10-08T01:00:00Z', new Date('2026-10-08T03:00:00Z')), 'Updated today');
  assert.equal(publicationLabel('2026-10-08T03:00:00Z', new Date('2026-10-08T04:01:00Z')), 'Updated 1d ago');
  // The daylight-saving change makes this calendar day shorter than 24 hours.
  assert.equal(publicationLabel('2026-03-08T05:30:00Z', new Date('2026-03-09T04:15:00Z')), 'Updated 1d ago');
  assert.equal(publicationLabel('2026-10-01T16:00:00Z', new Date('2026-10-08T16:00:00Z')), 'Updated 7d ago');
});

test('older and future versions show their full date, and invalid timestamps preserve the fallback', () => {
  const now = new Date('2026-10-08T16:00:00Z');
  assert.equal(publicationLabel('2026-09-01T16:00:00Z', now), 'Updated 01 Sept 2026');
  assert.equal(publicationLabel('2026-10-09T16:00:00Z', now), 'Updated 09 Oct 2026');
  assert.equal(publicationLabel('invalid', now), null);
});

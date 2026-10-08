import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationLabel } from '../src/scripts/publication-label.js';

test('relative updates use calendar days, including midnight and DST boundaries', () => {
  assert.equal(publicationLabel('2026-10-08T03:59:00Z', new Date('2026-10-08T04:01:00Z'), 'America/New_York').label, 'Updated 1d ago');
  assert.equal(publicationLabel('2026-10-08T04:01:00Z', new Date('2026-10-08T23:59:00Z'), 'America/New_York').label, 'Updated today');
  assert.equal(publicationLabel('2026-03-08T05:01:00Z', new Date('2026-03-09T04:01:00Z'), 'America/New_York').label, 'Updated 1d ago');
  assert.equal(publicationLabel('2026-11-01T04:01:00Z', new Date('2026-11-02T05:01:00Z'), 'America/New_York').label, 'Updated 1d ago');
});

test('full dates include the visitor timezone, old updates remain readable, and invalid dates are ignored', () => {
  const value = publicationLabel('2026-10-08T04:01:00Z', new Date('2026-10-08T04:02:00Z'), 'America/New_York');
  assert.match(value.full, /October 8, 2026/); assert.match(value.full, /EDT/);
  assert.equal(publicationLabel('2026-10-08T04:01:00Z', new Date('2026-10-09T04:02:00Z'), 'America/New_York').label, 'Updated 1d ago');
  assert.equal(publicationLabel('2026-10-08T04:01:00Z', new Date('2026-11-09T04:02:00Z'), 'America/New_York').label, 'Updated 10/8/2026');
  assert.equal(publicationLabel('2026-10-09T04:01:00Z', new Date('2026-10-08T04:02:00Z'), 'America/New_York').label, 'Updated today');
  assert.equal(publicationLabel('invalid'), null);
});

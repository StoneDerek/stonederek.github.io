import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { publicationLabel, mountPublicationLabel } from '../src/scripts/publication-label.js';

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

test('the timestamp expands in place for hover or focus and contracts only after both end', async () => {
  const window = new Window();
  window.document.write('<time data-publication-date datetime="2026-11-06T02:00:00Z" tabindex="0">Updated today</time>');
  const time = window.document.querySelector('time');
  const value = publicationLabel(time.dateTime);
  const release = mountPublicationLabel(time);
  try {
    assert.equal(time.textContent, value.label);
    assert.equal(time.getAttribute('aria-label'), value.full);
    time.dispatchEvent(new window.Event('pointerenter'));
    assert.equal(time.textContent, value.full);
    time.focus();
    time.dispatchEvent(new window.Event('pointerleave'));
    assert.equal(time.textContent, value.full, 'keyboard focus keeps the full date visible after the pointer leaves');
    time.blur();
    assert.equal(time.textContent, value.label);
    time.focus();
    assert.equal(time.textContent, value.full, 'keyboard focus alone expands the date');
    time.dispatchEvent(new window.Event('pointerenter'));
    time.blur();
    assert.equal(time.textContent, value.full, 'hover keeps the full date visible after focus leaves');
    time.dispatchEvent(new window.Event('pointerleave'));
    assert.equal(time.textContent, value.label);
    assert.equal(time.dateTime, '2026-11-06T02:00:00Z');
    assert.equal(window.document.querySelector('time'), time, 'the focusable timestamp is retained');
  } finally { release(); await window.happyDOM.close(); }
});

test('refreshes preserve the expanded date and unmounting clears its timer and interaction listeners', async () => {
  const window = new Window();
  window.document.write('<time data-publication-date datetime="2026-11-06T02:00:00Z" tabindex="0"></time>');
  Object.defineProperty(window.document, 'hidden', { configurable: true, value: false });
  const timers = new Map();
  let sequence = 0;
  window.setTimeout = callback => { timers.set(++sequence, callback); return sequence; };
  window.clearTimeout = id => timers.delete(id);
  const time = window.document.querySelector('time');
  time.focus();
  const release = mountPublicationLabel(time);
  try {
    assert.equal(time.textContent, publicationLabel(time.dateTime).full, 'mounting an already focused timestamp shows the full date');
    assert.equal(timers.size, 1);
    time.dateTime = '2026-10-08T04:01:00Z';
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    const full = publicationLabel(time.dateTime).full;
    assert.equal(time.textContent, full);
    window.dispatchEvent(new window.Event('pageshow'));
    assert.equal(time.textContent, full);
    assert.equal(timers.size, 1, 'refreshes replace the midnight timer');
    const midnight = timers.values().next().value;
    midnight();
    assert.equal(time.textContent, full, 'the midnight update preserves focus state');
    assert.equal(timers.size, 1);
    release();
    assert.equal(timers.size, 0);
    time.blur();
    time.dateTime = '2026-09-01T00:00:00Z';
    window.dispatchEvent(new window.Event('pageshow'));
    assert.equal(time.textContent, full, 'unmounted labels no longer respond to focus or page events');
  } finally { release(); await window.happyDOM.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRequests } from '../src/scripts/project-navigation.js';

function scene({ open = true, index = 0 } = {}) {
  const current = { open, index };
  const calls = [];
  let cancellations = 0;
  let settlements = 0;
  const navigation = createProjectRequests({
    getCurrent: () => ({ ...current }),
    async open(request, { replacing }) {
      calls.push({ action: 'open', index: request.index, replacing });
      current.index = request.index;
      await Promise.resolve();
      current.open = true;
    },
    async close() {
      calls.push({ action: 'close' });
      await Promise.resolve();
      current.open = false;
    },
    cancel: () => cancellations++,
    settled: () => settlements++
  });
  return { current, calls, navigation, get cancellations() { return cancellations; }, get settlements() { return settlements; } };
}

test('choosing a different article opens it once without any closing transition', async () => {
  const s = scene({ index: 0 });
  await s.navigation.request({ index: 4 });
  assert.deepEqual(s.calls, [{ action: 'open', index: 4, replacing: true }]);
  assert.deepEqual(s.current, { open: true, index: 4 });
  assert.equal(s.navigation.busy, false);
  assert.equal(s.settlements, 1);
});

test('gallery opening, same-article selection, and an explicit gallery return remain distinct', async () => {
  const s = scene({ open: false });
  await s.navigation.request({ index: 2 });
  await s.navigation.request({ index: 2 });
  await s.navigation.request({ index: null });
  await s.navigation.request({ index: null });
  assert.deepEqual(s.calls, [{ action: 'open', index: 2, replacing: false }, { action: 'close' }]);
  assert.equal(s.current.open, false);
});

test('rapid selections discard intermediate queued articles and never add a closing animation', async () => {
  const s = scene();
  const completed = s.navigation.request({ index: 1 });
  s.navigation.request({ index: 2 });
  s.navigation.request({ index: 5 });
  assert.equal(s.navigation.busy, true);
  assert.equal(s.navigation.pending.index, 5);
  await completed;
  assert.deepEqual(s.calls, [
    { action: 'open', index: 1, replacing: true },
    { action: 'open', index: 5, replacing: true }
  ]);
  assert.deepEqual(s.current, { open: true, index: 5 });
  assert.equal(s.cancellations, 3);
  assert.equal(s.settlements, 1);
  assert.equal(s.navigation.pending, null);
});

test('Home during an opening resolves to the gallery with one deliberate close', async () => {
  const s = scene();
  const completed = s.navigation.request({ index: 3 });
  s.navigation.request({ index: null });
  await completed;
  assert.deepEqual(s.calls, [{ action: 'open', index: 3, replacing: true }, { action: 'close' }]);
  assert.equal(s.current.open, false);
  assert.equal(s.navigation.busy, false);
});

test('reselecting the incoming article during a switch finishes it without restarting', async () => {
  const s = scene();
  const completed = s.navigation.request({ index: 3 });
  s.navigation.request({ index: 3 });
  await completed;
  assert.deepEqual(s.calls, [{ action: 'open', index: 3, replacing: true }]);
  assert.equal(s.current.index, 3);
  assert.equal(s.current.open, true);
});

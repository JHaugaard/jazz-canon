import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boxesOverlap,
  compareLabelPriority,
  labelBox,
  planAlbumLabels,
} from './constellation-labels.ts';

const c = (id, x, y, sharedPlayers, year, extra = {}) => ({
  id, x, y, r: 30, title: `Album ${id}`, year, sharedPlayers, eligible: true, ...extra,
});

function assertNoOverlap(plan, { exceptRequired = true } = {}) {
  for (let i = 0; i < plan.placed.length; i++) {
    for (let j = i + 1; j < plan.placed.length; j++) {
      const a = plan.placed[i], b = plan.placed[j];
      if (exceptRequired && a.required && b.required) continue;
      assert.equal(boxesOverlap(a.box, b.box), false, `${a.id} overlaps ${b.id}`);
    }
  }
}

test('label box hangs centred below the node rim', () => {
  const box = labelBox(c('a', 100, 200, 1, 1960), { padding: 0 });
  assert.equal(box.top, 235); // y + r + topOffset
  assert.equal(box.bottom, 263); // + height 28
  assert.ok(Math.abs((box.left + box.right) / 2 - 100) < 1e-9);
});

test('more shared players wins a collision', () => {
  const plan = planAlbumLabels([c('low', 0, 0, 1, 1950), c('high', 10, 0, 3, 1970)]);
  assert.deepEqual([...plan.shown], ['high']);
  assert.deepEqual(plan.suppressed, ['low']);
});

test('earlier year breaks a shared-player tie', () => {
  const plan = planAlbumLabels([c('late', 0, 0, 2, 1965), c('early', 10, 0, 2, 1958)]);
  assert.deepEqual([...plan.shown], ['early']);
});

test('title then id give a total order', () => {
  const a = { ...c('b', 0, 0, 2, 1960), title: 'Same' };
  const b = { ...c('a', 0, 0, 2, 1960), title: 'Same' };
  assert.ok(compareLabelPriority(b, a) < 0);
  assert.ok(compareLabelPriority({ ...a, title: 'A' }, { ...b, title: 'B' }) < 0);
});

test('non-colliding labels are all shown', () => {
  const plan = planAlbumLabels([c('a', 0, 0, 1, 1960), c('b', 400, 0, 1, 1960), c('c', 0, 400, 1, 1960)]);
  assert.equal(plan.shown.size, 3);
  assert.deepEqual(plan.suppressed, []);
});

test('ineligible labels are never placed unless required', () => {
  const plan = planAlbumLabels([c('a', 0, 0, 5, 1960, { eligible: false }), c('b', 400, 0, 1, 1960)]);
  assert.deepEqual([...plan.shown], ['b']);
  assert.deepEqual(plan.suppressed, []); // ineligible is not "suppressed"
});

test('required (focused/hovered) label beats higher priority and ignores eligibility', () => {
  const plan = planAlbumLabels([
    c('top', 0, 0, 9, 1950),
    c('focus', 10, 0, 1, 1970, { required: true, eligible: false }),
  ]);
  assert.deepEqual([...plan.shown], ['focus']);
  assert.deepEqual(plan.suppressed, ['top']);
});

test('two overlapping required labels are both kept and reported', () => {
  const plan = planAlbumLabels([
    c('hover', 0, 0, 1, 1960, { required: true }),
    c('focus', 5, 0, 1, 1961, { required: true }),
  ]);
  assert.equal(plan.shown.size, 2);
  assert.deepEqual(plan.requiredConflicts, [['hover', 'focus']]);
});

test('greedy keeps the highest-priority subset, not the largest one', () => {
  // middle label collides with both neighbours; neighbours do not collide.
  const plan = planAlbumLabels([c('left', 0, 0, 1, 1960), c('mid', 60, 0, 5, 1960), c('right', 120, 0, 1, 1960)]);
  assert.deepEqual([...plan.shown], ['mid']);
});

test('edge-touching boxes do not collide', () => {
  assert.equal(boxesOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 }), false);
});

test('graph mode is zoom-invariant', () => {
  const cands = [c('a', 0, 0, 1, 1960), c('b', 40, 0, 2, 1960), c('c', 80, 0, 3, 1960)];
  const at1 = planAlbumLabels(cands, { k: 1 });
  const at4 = planAlbumLabels(cands, { k: 4 });
  assert.deepEqual([...at1.shown], [...at4.shown]);
  assert.ok(at1.suppressed.length > 0); // fixture really collides
});

test('screen mode: zooming in frees space and reveals more labels', () => {
  const cands = [c('a', 0, 0, 1, 1960), c('b', 40, 0, 2, 1960)];
  const reset = planAlbumLabels(cands, { labelScale: 'screen', k: 1 });
  const zoomed = planAlbumLabels(cands, { labelScale: 'screen', k: 3 });
  assert.equal(reset.shown.size, 1);
  assert.equal(zoomed.shown.size, 2);
  assertNoOverlap(zoomed);
});

test('custom measureText is honoured', () => {
  const narrow = planAlbumLabels([c('a', 0, 0, 1, 1960), c('b', 40, 0, 1, 1960)], { measureText: () => 10 });
  assert.equal(narrow.shown.size, 2);
});

test('deterministic and input-order independent; no overlaps at many zoom levels', () => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const cands = Array.from({ length: 120 }, (_, i) =>
    c(`n${i}`, rnd() * 900, rnd() * 600, 1 + Math.floor(rnd() * 6), 1945 + Math.floor(rnd() * 40), {
      eligible: rnd() > 0.15,
      required: i === 7 || i === 33,
    }));
  const reversed = [...cands].reverse();
  for (const k of [0.4, 1, 1.7, 4]) {
    for (const labelScale of ['graph', 'screen']) {
      const p1 = planAlbumLabels(cands, { k, labelScale });
      const p2 = planAlbumLabels(reversed, { k, labelScale });
      assert.deepEqual(p1.placed, p2.placed);
      assertNoOverlap(p1);
      assert.ok(p1.shown.has('n7') && p1.shown.has('n33'));
      // every suppressed label really collides with something placed
      for (const id of p1.suppressed) {
        const box = labelBox(cands.find((x) => x.id === id), { k, labelScale });
        assert.ok(p1.placed.some((p) => boxesOverlap(box, p.box)));
      }
    }
  }
});

test('input is not mutated; duplicate ids and bad k are rejected', () => {
  const cands = Object.freeze([Object.freeze(c('a', 0, 0, 1, 1960)), Object.freeze(c('b', 300, 0, 1, 1960))]);
  planAlbumLabels(cands);
  assert.throws(() => planAlbumLabels([c('a', 0, 0, 1, 1960), c('a', 300, 0, 1, 1960)]), /duplicate/);
  assert.throws(() => planAlbumLabels([c('a', 0, 0, 1, 1960)], { k: 0 }), RangeError);
});

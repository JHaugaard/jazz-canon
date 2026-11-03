import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WINDOW_MAX_ALBUMS,
  WINDOW_MAX_WIDTH,
  adaptiveTimeWindow,
  filterConstellationWindow,
} from './constellation-time.ts';

const BOUNDS = { min: 1945, max: 1985 }; // canon-wide year axis
const win = (center, start, end) => ({ center, start, end, width: end - start + 1 });

// rows: [personId, name, albumId, ...instruments]; export-like edge order.
const graphOf = (rows) => {
  const people = {};
  const edges = [];
  for (const [p, name, a, ...instruments] of rows) {
    people[p] = people[p] ?? name;
    edges.push({ p, a, entries: instruments.map((instrument) => ({ instrument, e: 'obs' })) });
  }
  return { people, edges };
};

/* p1+p2 are the selection. A0–A3 credit both (the intersection, in export
   order); B1 (1959) credits p1 without p2, so it is outside this constellation
   and must never be counted for it. */
const G = graphOf([
  ['p1', 'Leader', 'A0', 'piano'],
  ['p2', 'Side', 'A0', 'bass'],
  ['p3', 'Guest', 'A0', 'drums'],
  ['p1', 'Leader', 'A1', 'piano'],
  ['p2', 'Side', 'A1', 'bass'],
  ['p3', 'Guest', 'A1', 'drums'],
  ['p1', 'Leader', 'A2', 'piano'],
  ['p2', 'Side', 'A2', 'bass'],
  ['p3', 'Guest', 'A2', 'drums'],
  ['p4', 'Other', 'A2', 'sax'],
  ['p1', 'Leader', 'A3', 'piano'],
  ['p2', 'Side', 'A3', 'bass'],
  ['p4', 'Other', 'A3', 'sax'],
  ['p1', 'Leader', 'B1', 'piano'],
  ['p4', 'Other', 'B1', 'sax'],
]);
const YEARS = new Map([
  ['A0', 1956],
  ['A1', 1957],
  ['A2', 1958],
  ['A3', 1960],
  ['B1', 1959],
]);
const GROUP_ALBUMS = ['A0', 'A1', 'A2', 'A3'];
const group = (window) =>
  filterConstellationWindow({
    graph: G,
    selectedIds: ['p1', 'p2'],
    fullAlbumIds: GROUP_ALBUMS,
    albumYears: YEARS,
    window,
  });

/* ---- adaptiveTimeWindow ------------------------------------------------- */

test('empty years expand to the widest clamped window', () => {
  assert.deepEqual(adaptiveTimeWindow([], 1957, BOUNDS), win(1957, 1953, 1962));
  // order and duplicates of years do not matter, only per-year counts
  assert.deepEqual(adaptiveTimeWindow([1962, 1957, 1962], 1957, BOUNDS), win(1957, 1953, 1962));
});

test('windows are centered and their edges are inclusive years', () => {
  assert.deepEqual(adaptiveTimeWindow([], 1957, BOUNDS, { maxWidth: 5 }), win(1957, 1955, 1959));
  // even widths put the extra year after the center
  assert.deepEqual(adaptiveTimeWindow([], 1957, BOUNDS, { maxWidth: 4 }), win(1957, 1956, 1959));
  assert.deepEqual(adaptiveTimeWindow([], 1957, BOUNDS, { maxWidth: 3 }), win(1957, 1956, 1958));
  assert.deepEqual(adaptiveTimeWindow([], 1957, BOUNDS, { maxWidth: 1 }), win(1957, 1957, 1957));
  // the budget counts albums in the window, not per year: 8 in one year is fine anywhere
  const eight = Array.from({ length: 8 }, () => 1957);
  assert.deepEqual(adaptiveTimeWindow(eight, 1957, BOUNDS), win(1957, 1953, 1962));
});

test('a dense year keeps its one-year window even over budget', () => {
  const eight = Array.from({ length: 8 }, () => 1957);
  const nine = Array.from({ length: 9 }, () => 1957);
  assert.deepEqual(adaptiveTimeWindow(nine, 1957, BOUNDS), win(1957, 1957, 1957));
  // a year at exactly the budget stays one year wide once a neighbour tips it over
  assert.deepEqual(adaptiveTimeWindow([...eight, 1958], 1957, BOUNDS), win(1957, 1957, 1957));
  // the budget itself is an option
  assert.deepEqual(adaptiveTimeWindow([1957, 1957, 1957], 1957, BOUNDS, { maxAlbums: 2 }), win(1957, 1957, 1957));
});

test('sparse constellations expand, contracting only as far as the data needs', () => {
  // Ron-Carter-sparse: a few albums anywhere in a decade still fit the widest window
  assert.deepEqual(adaptiveTimeWindow([1971, 1972, 1973], 1971, BOUNDS), win(1971, 1967, 1976));
  // 9 albums in 1955 poison every window that reaches it; 4+4 in 1956–1957 fit at width 4
  const mixed = [...Array(9).fill(1955), ...Array(4).fill(1956), ...Array(4).fill(1957)];
  assert.deepEqual(adaptiveTimeWindow(mixed, 1957, BOUNDS), win(1957, 1956, 1959));
});

test('centers at or beyond the bounds clamp inside the year axis', () => {
  assert.deepEqual(adaptiveTimeWindow([], 1945, BOUNDS), win(1945, 1945, 1950)); // narrowed at the min edge
  assert.deepEqual(adaptiveTimeWindow([], 1985, BOUNDS), win(1985, 1981, 1985)); // narrowed at the max edge
  assert.deepEqual(adaptiveTimeWindow([], 1930, BOUNDS), win(1945, 1945, 1950)); // center clamped up
  assert.deepEqual(adaptiveTimeWindow([], 1990, BOUNDS), win(1985, 1981, 1985)); // center clamped down
  // a one-year canon collapses every width onto its single year
  assert.deepEqual(adaptiveTimeWindow([1945], 1945, { min: 1945, max: 1945 }), win(1945, 1945, 1945));
});

test('a single album expands to full width and survives only inside its year', () => {
  assert.deepEqual(adaptiveTimeWindow([1959], 1959, BOUNDS), win(1959, 1955, 1964));
  const r = filterConstellationWindow({
    graph: G, selectedIds: ['p1', 'p2'], fullAlbumIds: ['A2'], albumYears: YEARS, window: win(1958, 1958, 1958),
  });
  assert.deepEqual(r.albumIds, ['A2']);
  assert.deepEqual([...r.visibleShared], [['p3', 1], ['p4', 1]]);
  assert.deepEqual([...r.overallShared], [['p3', 1], ['p4', 1]]);
  const gone = filterConstellationWindow({
    graph: G, selectedIds: ['p1', 'p2'], fullAlbumIds: ['A2'], albumYears: YEARS, window: win(1957, 1957, 1957),
  });
  assert.deepEqual(gone.albumIds, []);
  assert.deepEqual(gone.visibleShared, new Map());
  assert.deepEqual([...gone.overallShared], [['p3', 1], ['p4', 1]]);
});

test('deterministic, and rejects malformed input', () => {
  assert.deepEqual(
    adaptiveTimeWindow([1957, 1958, 1959], 1957, BOUNDS),
    adaptiveTimeWindow([1959, 1957, 1958], 1957, BOUNDS),
  );
  assert.equal(WINDOW_MAX_WIDTH, 10);
  assert.equal(WINDOW_MAX_ALBUMS, 8);
  assert.throws(() => adaptiveTimeWindow([], 1957.5, BOUNDS), RangeError);
  assert.throws(() => adaptiveTimeWindow([], Number.NaN, BOUNDS), RangeError);
  assert.throws(() => adaptiveTimeWindow([], 1957, { min: 1985, max: 1945 }), RangeError);
  assert.throws(() => adaptiveTimeWindow([], 1957, { min: 'x', max: 1985 }), RangeError);
  assert.throws(() => adaptiveTimeWindow([], 1957, BOUNDS, { maxAlbums: 0 }), RangeError);
  assert.throws(() => adaptiveTimeWindow([], 1957, BOUNDS, { maxWidth: 2.5 }), RangeError);
});

/* ---- filterConstellationWindow ------------------------------------------ */

test('null window is the full range: visible and overall coincide', () => {
  const r = group(null);
  assert.deepEqual(r.albumIds, GROUP_ALBUMS);
  assert.deepEqual([...r.visibleShared], [['p3', 3], ['p4', 2]]);
  assert.deepEqual([...r.visibleShared], [...r.overallShared]);
});

test('empty inputs and empty windows are honest empties', () => {
  const emptyGraph = { people: {}, edges: [] };
  for (const window of [null, win(1957, 1957, 1958)]) {
    const r = filterConstellationWindow({
      graph: emptyGraph, selectedIds: [], fullAlbumIds: [], albumYears: new Map(), window,
    });
    assert.deepEqual(r.albumIds, []);
    assert.deepEqual(r.visibleShared, new Map());
    assert.deepEqual(r.overallShared, new Map());
  }
  // a window over a real constellation but with no albums in it: empty visible, honest overall
  const none = group(win(1970, 1970, 1970));
  assert.deepEqual(none.albumIds, []);
  assert.deepEqual(none.visibleShared, new Map());
  assert.deepEqual([...none.overallShared], [['p3', 3], ['p4', 2]]);
  // B1 (1959) is inside these years but outside the intersection: still empty
  assert.deepEqual(group(win(1959, 1959, 1959)).albumIds, []);
});

test('window edges are inclusive; years just outside are not visible', () => {
  const r = group(win(1957, 1957, 1958)); // A1 at start edge, A2 at end edge; A0 (1956) and A3 (1960) out
  assert.deepEqual(r.albumIds, ['A1', 'A2']);
  assert.deepEqual([...r.visibleShared], [['p3', 2], ['p4', 1]]);
  assert.deepEqual([...r.overallShared], [['p3', 3], ['p4', 2]]);
  assert.deepEqual(group(win(1956, 1956, 1960)).albumIds, GROUP_ALBUMS);
});

test('group selection: intersection albums only, selected musicians never counted', () => {
  const r = group(null);
  // B1 credits p1+p4 but not p2: it is outside the group constellation, so p4 counts 2, not 3
  assert.equal(r.overallShared.get('p4'), 2);
  assert.equal(r.overallShared.get('p3'), 3);
  assert.ok(!r.overallShared.has('p1') && !r.overallShared.has('p2'));
  // output order follows fullAlbumIds even when it is not the export order
  const ordered = filterConstellationWindow({
    graph: G, selectedIds: ['p1', 'p2'], fullAlbumIds: ['A3', 'A0', 'A2'], albumYears: YEARS, window: win(1956, 1956, 1958),
  });
  assert.deepEqual(ordered.albumIds, ['A0', 'A2']);
});

test('a repeat collaborator can become one-off inside a narrow window', () => {
  // p4 shares 3 albums with p1 overall, but in 1959–1960 only A3 and B1 are visible
  const solo = (window) =>
    filterConstellationWindow({
      graph: G, selectedIds: ['p1'], fullAlbumIds: [...GROUP_ALBUMS, 'B1'], albumYears: YEARS, window,
    });
  assert.deepEqual(solo(null).albumIds, ['A0', 'A1', 'A2', 'A3', 'B1']);
  assert.deepEqual([...solo(null).overallShared], [['p2', 4], ['p3', 3], ['p4', 3]]);
  assert.ok(!solo(null).overallShared.has('p1'));
  const narrow = solo(win(1959, 1959, 1960));
  assert.deepEqual(narrow.albumIds, ['A3', 'B1']);
  assert.deepEqual([...narrow.visibleShared], [['p2', 1], ['p4', 2]]);
  assert.ok(!narrow.visibleShared.has('p3')); // 0 in window -> absent, not 0
  assert.equal(narrow.overallShared.get('p3'), 3); // tooltip keeps the overall count
  assert.ok(narrow.visibleShared.get('p4') <= narrow.overallShared.get('p4'));
});

test('albums without a year show at full range but never inside a window', () => {
  const years = new Map(YEARS);
  years.delete('A2'); // A2 has no placeable year
  const cut = filterConstellationWindow({
    graph: G, selectedIds: ['p1', 'p2'], fullAlbumIds: GROUP_ALBUMS, albumYears: years, window: win(1958, 1958, 1958),
  });
  assert.deepEqual(cut.albumIds, []);
  const full = filterConstellationWindow({
    graph: G, selectedIds: ['p1', 'p2'], fullAlbumIds: GROUP_ALBUMS, albumYears: years, window: null,
  });
  assert.deepEqual(full.albumIds, GROUP_ALBUMS);
  assert.deepEqual([...full.visibleShared], [...full.overallShared]);
});

test('large synthetic input: invariants and an independent tally agree', () => {
  let seed = 20261103; // deterministic LCG, no dependencies
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const people = {};
  const edges = [];
  const albumYears = new Map();
  const years = [];
  const ids = [];
  for (let i = 0; i < 600; i++) {
    const id = `a${i}`;
    // dense pockets in the Chambers years plus a sparse canon at large
    const y = i % 7 < 3 ? 1957 + Math.floor(rnd() * 5) : 1945 + Math.floor(rnd() * 41);
    albumYears.set(id, y);
    years.push(y);
    ids.push(id);
    for (let j = 0; j < 4; j++) {
      const p = `p${(i * 7 + j * 13) % 220}`;
      people[p] = p;
      edges.push({ p, a: id, entries: [{ instrument: 'sax', e: 'obs' }] });
    }
  }
  const graph = { people, edges };
  const tally = (start, end) => years.filter((y) => y >= start && y <= end).length; // independent recount

  for (const center of [1945, 1950, 1957, 1959, 1971, 1980, 1985]) {
    const w = adaptiveTimeWindow(years, center, BOUNDS);
    assert.ok(w.start >= BOUNDS.min && w.end <= BOUNDS.max, `out of bounds at ${center}`);
    assert.ok(w.start <= w.center && w.center <= w.end, `center ${center} outside its window`);
    assert.equal(w.center, center); // every tested center is already inside the bounds
    assert.equal(w.width, w.end - w.start + 1);
    assert.ok(w.width >= 1 && w.width <= WINDOW_MAX_WIDTH, `width ${w.width} at ${center}`);
    const n = tally(w.start, w.end);
    assert.ok(n <= WINDOW_MAX_ALBUMS || w.width === 1, `budget broken at ${center}: ${n} in ${w.start}-${w.end}`);
    // no wider window fits — skipping widths that clamp onto this same window
    // (near an edge, several widths clamp to identical years)
    for (let ww = w.width + 1; ww <= WINDOW_MAX_WIDTH; ww++) {
      const s = Math.max(center - Math.floor((ww - 1) / 2), BOUNDS.min);
      const e = Math.min(center + Math.ceil((ww - 1) / 2), BOUNDS.max);
      if (s >= w.start && e <= w.end) continue;
      assert.ok(tally(s, e) > WINDOW_MAX_ALBUMS, `wider window ${ww} also fits at ${center}`);
    }
  }

  const full = filterConstellationWindow({ graph, selectedIds: ['p0'], fullAlbumIds: ids, albumYears, window: null });
  assert.equal(full.albumIds.length, ids.length);
  assert.deepEqual([...full.visibleShared], [...full.overallShared]);
  assert.ok(!full.overallShared.has('p0'));

  for (const center of [1957, 1960, 1975]) {
    const w = adaptiveTimeWindow(years, center, BOUNDS);
    const r = filterConstellationWindow({ graph, selectedIds: ['p0'], fullAlbumIds: ids, albumYears, window: w });
    assert.deepEqual(
      r.albumIds,
      ids.filter((id) => {
        const y = albumYears.get(id);
        return y >= w.start && y <= w.end;
      }),
    );
    for (const [p, n] of r.visibleShared) {
      assert.ok(r.overallShared.has(p), `${p} visible but not overall`);
      assert.ok(n <= r.overallShared.get(p), `${p} visible ${n} > overall`);
    }
  }
});
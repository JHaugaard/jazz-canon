import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeLayout, START_YEAR, END_YEAR, OPEN_YEAR, ERA_BANDS, eraLanes, STYLE_INK, CARD_W, CARD_H, CARD_GAP } from '../src/lib/timeline-layout.ts';
import { gatesOf, primaryGate } from '../src/lib/gates.ts';
import { productionRows } from '../src/lib/production-credits.ts';

const albums = JSON.parse(readFileSync(new URL('../public/data/albums.json', import.meta.url)));
const fixture = (year, id = `fixture-${year}`) => ({ ...albums[0], id, year, styleCode: 'bebop', styleTags: [] });

test('1945–1985 canvas, 1965 opening, and all real exported albums fit', () => {
  assert.equal(START_YEAR, 1945);
  assert.equal(END_YEAR, 1985);
  assert.equal(OPEN_YEAR, 1965);
  for (const count of [1, 2, 3, 4]) {
    const layout = computeLayout(albums, count);
    assert.equal(layout.cards.length, albums.length);
    assert.equal(layout.years[0].year, 1945);
    assert.equal(layout.years.at(-1).year, 1985);
    assert.equal(layout.xOfYear(1986), layout.totalWidth);
  }
});

test('Bebop classification is independent of era endpoint; future boundary records render', () => {
  const records = [fixture(1945), fixture(1955), fixture(1960), fixture(1985)];
  assert.equal(computeLayout(records, 2).cards.length, 4);
  for (const album of records) {
    assert.deepEqual(gatesOf(album), ['bebop']);
    assert.equal(primaryGate(album), 'bebop');
  }
  assert.deepEqual(gatesOf({ ...records[0], styleCode: 'hard-bop', styleTags: ['bebop', 'ecm'] }), ['bebop', 'ecm']);
  const band = ERA_BANDS.find(b => b.name === 'Bebop');
  assert.equal(band.from, 1945);
  assert.equal(band.to, 1955);
});

test('dense early-year fixtures expand columns without card-coordinate collisions', () => {
  const records = Array.from({ length: 60 }, (_, i) => fixture(1945, `dense-${i}`));
  for (const count of [1, 2, 3, 4]) {
    const layout = computeLayout(records, count);
    assert.equal(layout.cards.length, records.length);
    assert.equal(new Set(layout.cards.map(c => `${c.x}:${c.y}`)).size, records.length);
    for (let i = 0; i < layout.cards.length; i++) {
      for (const other of layout.cards.slice(i + 1)) {
        const card = layout.cards[i];
        assert.ok(Math.abs(card.x - other.x) >= CARD_W || Math.abs(card.y - other.y) >= CARD_H);
      }
    }
    const year = layout.years[0];
    assert.ok(layout.cards.every(c => c.x >= year.x0 && c.x + CARD_W <= year.x0 + year.width));
  }
});

test('era ribbon: coexisting eras never share a lane, and lanes stay packed', () => {
  assert.equal(ERA_BANDS.length, 7);
  const lanes = eraLanes();
  assert.equal(lanes.length, ERA_BANDS.length);
  // `to` is inclusive: two eras in one lane must not share a single year
  // (Bebop ends 1955 where Hard Bop begins, so they cannot share a lane).
  for (let i = 0; i < ERA_BANDS.length; i++) {
    for (let j = i + 1; j < ERA_BANDS.length; j++) {
      if (lanes[i] !== lanes[j]) continue;
      const [a, b] = [ERA_BANDS[i], ERA_BANDS[j]];
      assert.ok(a.to < b.from || b.to < a.from, `${a.name} and ${b.name} overlap in lane ${lanes[i]}`);
    }
  }
  // packed: lane count equals the most eras alive in any single year
  let peak = 0;
  for (let y = START_YEAR; y <= END_YEAR; y++) peak = Math.max(peak, ERA_BANDS.filter(b => b.from <= y && y <= b.to).length);
  assert.equal(Math.max(...lanes) + 1, peak);
});

test('every primary style in the data has an era hue for its style line', () => {
  const missing = [...new Set(albums.map(a => a.styleCode))].filter(c => !STYLE_INK[c]);
  // european-jazz is the one deliberate exception: no era, so it reads muted
  assert.deepEqual(missing, ['european-jazz']);
});

const credit = (overrides = {}) => ({ personId: 'fixture-person', name: 'Test Person', role: 'producer', e: 'obs', sessionId: null, ...overrides });
test('old and empty exports have no production rows', () => {
  assert.deepEqual(productionRows(), []);
  assert.deepEqual(productionRows([]), []);
});
test('credit rows retain role and identity; session duplicates do not inflate display', () => {
  const source = [credit(), credit({ sessionId: 's1', e: 'inf' }), credit({ role: 'engineer' }), credit({ personId: 'different-same-name', role: 'engineer', e: 'unk', sessionId: 's2' })];
  const before = JSON.stringify(source);
  const rows = productionRows(source);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].role, 'producer');
  assert.equal(rows[0].e, 'inf');
  assert.equal(rows[0].sessionOnly, false);
  assert.equal(rows.find(r => r.personId === 'different-same-name').sessionOnly, true);
  assert.equal(JSON.stringify(source), before);
});
test('mixing and mastering are not relabeled Engineer', () => {
  assert.deepEqual(productionRows([credit({ role: 'mixing' }), credit({ role: 'mastering' })]), []);
});

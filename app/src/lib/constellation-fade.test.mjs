import assert from 'node:assert/strict';
import test from 'node:test';
import { constellationFade, quietnessFor, FADE_RANGES } from './constellation-fade.ts';

const at = (albumCount, collaboratorCount, zoomRatio = 1) =>
  constellationFade({ albumCount, collaboratorCount, zoomRatio });
const inRange = (v, lo, hi, label) => assert.ok(v >= lo && v <= hi, `${label}: ${v} not in [${lo}, ${hi}]`);
const OUTPUTS = Object.keys(FADE_RANGES);

test('small graphs keep the current rich look', () => {
  const f = at(3, 15);
  inRange(f.oneOffDot, 0.34, 0.36, 'dot');
  inRange(f.centerEdge, 0.31, 0.32, 'center edge');
  inRange(f.oneOffEdge, 0.054, 0.056, 'one-off edge');
});

test('Paul Chambers (37 albums / 123 collaborators) hits the brief', () => {
  const f = at(37, 123);
  inRange(f.oneOffDot, 0.18, 0.22, 'dot');
  inRange(f.oneOffEdge, 0.02, 0.031, 'one-off edge');
  assert.ok(f.centerEdge < 0.32 * 0.75, `center spokes quieter: ${f.centerEdge}`);
});

test('100+ albums trend toward .10-.14 dots and .01-.02 edges', () => {
  const f = at(100, 250);
  inRange(f.oneOffDot, 0.10, 0.14, 'dot');
  inRange(f.oneOffEdge, 0.01, 0.02, 'one-off edge');
});

test('200-300 albums are very quiet but never invisible', () => {
  for (const [a, c] of [[200, 500], [300, 750], [5000, 20000]]) {
    const f = at(a, c);
    for (const k of OUTPUTS) assert.ok(f[k] >= FADE_RANGES[k][1], `${k} above floor at ${a}`);
    inRange(f.oneOffDot, 0.06, 0.10, `dot at ${a}`);
  }
});

test('zooming in 3x restores Chambers to near the small-graph look', () => {
  const reset = at(37, 123, 1), zoomed = at(37, 123, 3), small = at(3, 15);
  assert.ok(zoomed.oneOffDot > reset.oneOffDot * 1.5);
  assert.ok(Math.abs(zoomed.oneOffDot - small.oneOffDot) < 0.03, `${zoomed.oneOffDot}`);
});

test('monotone: more albums, more collaborators, or zooming out is never louder', () => {
  for (const k of OUTPUTS) {
    let prev = Infinity;
    for (let a = 0; a <= 400; a += 5) { const v = at(a, 3 * a)[k]; assert.ok(v <= prev + 1e-12, k); prev = v; }
    prev = Infinity;
    for (let c = 0; c <= 1000; c += 10) { const v = at(37, c)[k]; assert.ok(v <= prev + 1e-12, k); prev = v; }
    prev = -Infinity;
    for (let z = 0.25; z <= 8; z += 0.05) { const v = at(37, 123, z)[k]; assert.ok(v >= prev - 1e-12, k); prev = v; }
  }
});

test('smooth: no jumps between neighbouring sizes or zooms', () => {
  for (let a = 1; a <= 400; a++) {
    const d = Math.abs(at(a, 3 * a).oneOffDot - at(a + 1, 3 * (a + 1)).oneOffDot);
    assert.ok(d < 0.01, `jump ${d} at ${a}`);
  }
  for (let z = 0.25; z < 8; z += 0.01) {
    const d = Math.abs(at(37, 123, z).oneOffDot - at(37, 123, z + 0.01).oneOffDot);
    assert.ok(d < 0.01, `zoom jump ${d} at ${z}`);
  }
});

test('bounded everywhere by [floor, rich]; quietness strictly inside (0,1) for positive size', () => {
  for (const a of [0, 1, 37, 300, 1e6]) for (const z of [0.01, 0.25, 1, 3, 100]) {
    const f = at(a, a * 3, z);
    for (const k of OUTPUTS) inRange(f[k], FADE_RANGES[k][1], FADE_RANGES[k][0], `${k} a=${a} z=${z}`);
    assert.ok(f.quietness >= 0 && f.quietness < 1);
  }
  assert.equal(quietnessFor(0), 0);
});

test('zoom ratio is clamped to [0.25, 8]', () => {
  assert.deepEqual(at(37, 123, 100), at(37, 123, 8));
  assert.deepEqual(at(37, 123, 0.01), at(37, 123, 0.25));
});

test('focus-unrelated levels recede more as the graph grows', () => {
  const s = at(3, 15), c = at(37, 123), l = at(250, 600);
  assert.ok(s.unrelatedFocusNode > c.unrelatedFocusNode && c.unrelatedFocusNode > l.unrelatedFocusNode);
  assert.ok(s.unrelatedFocusEdge > c.unrelatedFocusEdge && c.unrelatedFocusEdge > l.unrelatedFocusEdge);
  assert.ok(c.unrelatedFocusNode < 0.85 && c.unrelatedFocusEdge < c.oneOffEdge + 0.01);
});

test('density measure is reported and documented', () => {
  const f = at(37, 123, 2);
  assert.equal(f.size, 37 + 123 / 4);
  assert.equal(f.perceivedSize, f.size / 4);
});

test('deterministic and rejects bad input', () => {
  assert.deepEqual(at(37, 123, 1.3), at(37, 123, 1.3));
  assert.throws(() => at(-1, 0), RangeError);
  assert.throws(() => at(1, NaN), RangeError);
  assert.throws(() => at(1, 1, 0), RangeError);
  assert.throws(() => at(1, 1, Infinity), RangeError);
});

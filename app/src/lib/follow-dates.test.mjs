import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateRangeWithMinimum,
  horizontalTarget,
  nextFollowMode,
  selectAnchorRow,
} from './follow-dates.ts';

test('date range keeps the editorial minimum and preserves real outliers', () => {
  assert.deepEqual(dateRangeWithMinimum(1950, 1979), [1945, 1985]);
  assert.deepEqual(dateRangeWithMinimum(1938, 1991), [1938, 1991]);
});

test('manual navigation pauses only active following and resume is explicit', () => {
  assert.equal(nextFollowMode('active', 'manual'), 'paused');
  assert.equal(nextFollowMode('paused', 'manual'), 'paused');
  assert.equal(nextFollowMode('off', 'manual'), 'off');
  assert.equal(nextFollowMode('paused', 'resume'), 'active');
  assert.equal(nextFollowMode('active', 'toggle-off'), 'off');
  assert.equal(nextFollowMode('off', 'toggle-on'), 'active');
});

test('anchor follows the row crossing the selection line', () => {
  const rows = [
    { id: 'early', top: 20, bottom: 50, markCount: 1 },
    { id: 'empty', top: 50, bottom: 80, markCount: 0 },
    { id: 'late', top: 80, bottom: 130, markCount: 2 },
  ];
  assert.equal(selectAnchorRow(rows, 35, 0, 120), 'early');
  assert.equal(selectAnchorRow(rows, 65, 0, 120), 'early');
  assert.equal(selectAnchorRow(rows, 90, 0, 120), 'late');
  assert.equal(selectAnchorRow(rows, 90, 0, 70), 'early');
  assert.equal(selectAnchorRow(rows, 60, 51, 75), null);
});

test('visible real marks prevent horizontal movement', () => {
  assert.equal(horizontalTarget({
    scrollLeft: 100,
    maxScrollLeft: 900,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [120, 500, 840],
    deadZone: 8,
  }), null);
});

test('nearest actual mark wins in either direction', () => {
  assert.equal(horizontalTarget({
    scrollLeft: 400,
    maxScrollLeft: 1000,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [210, 900],
    deadZone: 8,
  }), 360);
  assert.equal(horizontalTarget({
    scrollLeft: 400,
    maxScrollLeft: 1000,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [20, 725],
    deadZone: 8,
  }), 425);
});

test('dead zone and scroll limits prevent oscillation and overshoot', () => {
  assert.equal(horizontalTarget({
    scrollLeft: 100,
    maxScrollLeft: 900,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [244],
    deadZone: 8,
  }), null);
  assert.equal(horizontalTarget({
    scrollLeft: 20,
    maxScrollLeft: 900,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [100],
    deadZone: 8,
  }), 0);
  assert.equal(horizontalTarget({
    scrollLeft: 895,
    maxScrollLeft: 900,
    usableLeft: 250,
    usableRight: 700,
    markCenters: [900],
    deadZone: 8,
  }), null);
});
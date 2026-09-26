import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateRangeWithMinimum,
  horizontalTarget,
  leadingMarkTarget,
  anchorLine,
  nextFollowMode,
  RESUME_QUIET_MS,
  selectAnchorRow,
  verticalResumes,
  wheelIsHorizontal,
} from './follow-dates.ts';

test('date range keeps the editorial minimum and preserves real outliers', () => {
  assert.deepEqual(dateRangeWithMinimum(1950, 1979), [1945, 1985]);
  assert.deepEqual(dateRangeWithMinimum(1938, 1991), [1938, 1991]);
});

test('horizontal input takes over and vertical navigation hands control back', () => {
  assert.equal(nextFollowMode('following', 'horizontal'), 'manual');
  assert.equal(nextFollowMode('manual', 'horizontal'), 'manual');
  assert.equal(nextFollowMode('manual', 'vertical'), 'following');
  assert.equal(nextFollowMode('following', 'vertical'), 'following');
});

test('trackpad drift during a vertical swipe is not a horizontal pan', () => {
  // Real two-axis trackpad swipes aimed straight down carry sideways drift.
  assert.equal(wheelIsHorizontal(1, 40, false), false);
  assert.equal(wheelIsHorizontal(3, 30, false), false);
  assert.equal(wheelIsHorizontal(12, 14, false), false);
  assert.equal(wheelIsHorizontal(2, 0, false), false);
  // Deliberate sideways motion, and shift-wheel, still take over.
  assert.equal(wheelIsHorizontal(20, 3, false), true);
  assert.equal(wheelIsHorizontal(-9, 4, false), true);
  assert.equal(wheelIsHorizontal(0, 40, true), true);
});

test('vertical movement resumes only once the horizontal gesture is over', () => {
  assert.equal(verticalResumes(1000, 1000 - RESUME_QUIET_MS + 1, false), false);
  assert.equal(verticalResumes(1000, 1000 - RESUME_QUIET_MS, false), true);
  assert.equal(verticalResumes(5000, 0, true), false);
  assert.equal(verticalResumes(5000, -Infinity, false), true);
});

test('anchor is the first half-visible row with marks at the top', () => {
  const rows = [
    { id: 'clipped', top: -30, bottom: 14, markCount: 3 },
    { id: 'empty', top: 14, bottom: 58, markCount: 0 },
    { id: 'percy', top: 58, bottom: 102, markCount: 4 },
    { id: 'art', top: 102, bottom: 146, markCount: 8 },
  ];
  assert.equal(selectAnchorRow(rows, 0, 0, 400), 'percy');
  const mostlyVisible = [{ id: 'top', top: -10, bottom: 34, markCount: 1 }, ...rows.slice(2)];
  assert.equal(selectAnchorRow(mostlyVisible, 0, 0, 400), 'top');
  assert.equal(selectAnchorRow(rows, 0, 20, 50), null);
});

test('anchor line leaves the top only as vertical scrolling runs out', () => {
  assert.equal(anchorLine(30, 630, 900), 30);
  assert.equal(anchorLine(30, 630, 600), 30);
  assert.equal(anchorLine(30, 630, 100), 530);
  assert.equal(anchorLine(30, 630, 0), 628);
  const rows = [
    { id: 'second-last', top: 540, bottom: 584, markCount: 2 },
    { id: 'last', top: 584, bottom: 628, markCount: 2 },
  ];
  assert.equal(selectAnchorRow(rows, anchorLine(30, 630, 0), 30, 630), 'last');
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

test('first real mark settles at the resting point even with a later mark visible', () => {
  const view = { scrollLeft: 100, maxScrollLeft: 900, restingX: 330, deadZone: 8 };
  // Percy Heath: first dot far to the right, pan until it rests at the top left.
  assert.equal(leadingMarkTarget({ ...view, markCenters: [900, 760] }), 514);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [336, 500] }), null);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [250, 500] }), 36);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [] }), null);
});

test('resting-band edges do not trigger a full-band jump', () => {
  const view = { scrollLeft: 100, maxScrollLeft: 900, restingX: 330, deadZone: 0 };
  assert.equal(leadingMarkTarget({ ...view, markCenters: [347] }), 101);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [313] }), 99);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [346] }), null);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [314] }), null);
});

test('Working never pushes the top row past the left edge while late rows anchor', () => {
  const view = { scrollLeft: 400, maxScrollLeft: 2000, restingX: 330, deadZone: 8 };
  // Anchor at the bottom is a late row (first dot 900); top row's dot is at 400.
  assert.equal(leadingMarkTarget({ ...view, markCenters: [900], topRowLeading: 400 }), 486);
  // Without the top-row limit (Where), the late row settles fully.
  assert.equal(leadingMarkTarget({ ...view, markCenters: [900] }), 954);
  // Top row already at the band edge: no further pan.
  assert.equal(leadingMarkTarget({ ...view, markCenters: [900], topRowLeading: 314 }), null);
});

test('leading date settles from either direction and clamps at field boundaries', () => {
  const view = { scrollLeft: 400, maxScrollLeft: 900, restingX: 330, deadZone: 8 };
  assert.equal(leadingMarkTarget({ ...view, markCenters: [120, 820] }), 206);
  assert.equal(leadingMarkTarget({ ...view, markCenters: [1000] }), 900);
  assert.equal(leadingMarkTarget({ ...view, scrollLeft: 20, markCenters: [100] }), 0);
  assert.equal(leadingMarkTarget({ ...view, scrollLeft: 900, markCenters: [800] }), null);
});

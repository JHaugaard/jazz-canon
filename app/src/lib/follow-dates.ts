/** Following is on unless a deliberate horizontal gesture has taken over;
 * the next vertical navigation hands control back. There is no toggle. */
export type FollowMode = 'following' | 'manual';
export type FollowEvent = 'horizontal' | 'vertical';

/** How long vertical movement must stay clear of horizontal input before it
 * counts as a return to vertical browsing rather than part of a two-axis pan. */
export const RESUME_QUIET_MS = 300;

export interface RowGeometry {
  id: string;
  top: number;
  bottom: number;
  markCount: number;
}

export interface HorizontalTargetInput {
  scrollLeft: number;
  maxScrollLeft: number;
  usableLeft: number;
  usableRight: number;
  markCenters: number[];
  deadZone: number;
}

export interface LeadingMarkInput {
  scrollLeft: number;
  maxScrollLeft: number;
  /** Viewport x where a row's first mark should settle. */
  restingX: number;
  markCenters: number[];
  deadZone: number;
  /** Optional: the top visible row's first-dot x. When set, never pan so far
   * that this dot passes the left edge of the resting band. */
  topRowLeading?: number;
}

export function dateRangeWithMinimum(actualStart: number, actualEnd: number): [number, number] {
  return [Math.min(1945, actualStart), Math.max(1985, actualEnd)];
}

export function nextFollowMode(mode: FollowMode, event: FollowEvent): FollowMode {
  return event === 'horizontal' ? 'manual' : 'following';
}

/** A wheel event is a deliberate horizontal pan only when sideways motion
 * dominates. Trackpad swipes meant to go straight down carry a little
 * sideways drift; that drift must not take control away from following. */
export function wheelIsHorizontal(deltaX: number, deltaY: number, shiftKey: boolean): boolean {
  if (shiftKey) return Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
  const x = Math.abs(deltaX);
  return x >= 3 && x > 1.5 * Math.abs(deltaY);
}

/** Vertical movement resumes following once the horizontal gesture is over. */
export function verticalResumes(now: number, lastHorizontalAt: number, horizontalGestureHeld: boolean): boolean {
  return !horizontalGestureHeld && now - lastHorizontalAt >= RESUME_QUIET_MS;
}

/** Normally the anchor is the top visible row. Near the bottom the final
 * rows can never reach the top, so the line travels down to them as the
 * remaining vertical scroll runs out. */
export function anchorLine(visibleTop: number, visibleBottom: number, remainingScroll: number): number {
  const height = visibleBottom - visibleTop;
  return Math.min(visibleBottom - 2, visibleTop + Math.max(0, height - remainingScroll));
}

/** Select the first row with real marks that is at least half visible below
 * the anchor line, falling back to the nearest visible row that owns marks.
 * Empty rows never become pan targets. */
export function selectAnchorRow(
  rows: RowGeometry[],
  line: number,
  visibleTop: number,
  visibleBottom: number,
): string | null {
  const visible = rows.filter(
    (row) => row.markCount > 0 && row.bottom > visibleTop && row.top < visibleBottom,
  );
  if (visible.length === 0) return null;

  const first = visible.find((row) => {
    const middle = (row.top + row.bottom) / 2;
    return middle >= line && middle < visibleBottom;
  });
  if (first) return first.id;

  return visible.reduce((best, row) => {
    const rowDistance = distanceToRange(line, row.top, row.bottom);
    const bestDistance = distanceToRange(line, best.top, best.bottom);
    return rowDistance < bestDistance ? row : best;
  }).id;
}

/** Return the smallest clamped movement that puts a real mark in the safe
 * date area. Coordinates are viewport coordinates, so actual rendered mark
 * geometry (not dates, row ends, or percentages) drives the choice. */
export function horizontalTarget(input: HorizontalTargetInput): number | null {
  const { scrollLeft, usableLeft, usableRight, markCenters, deadZone } = input;
  if (markCenters.length === 0 || usableRight <= usableLeft) return null;
  if (markCenters.some((x) => x >= usableLeft && x <= usableRight)) return null;

  let delta = 0;
  let distance = Infinity;
  for (const x of markCenters) {
    const candidate = x < usableLeft ? x - usableLeft : x - usableRight;
    if (Math.abs(candidate) < distance) {
      delta = candidate;
      distance = Math.abs(candidate);
    }
  }
  if (distance <= deadZone) return null;

  const target = clamp(scrollLeft + delta, 0, input.maxScrollLeft);
  return Math.abs(target - scrollLeft) <= deadZone ? null : target;
}

/** Settle the row's earliest real mark at the resting point beside the name
 * column, even if a later mark is already visible. A small band around the
 * resting point keeps adjacent rows with near-identical first dates still. */
export function leadingMarkTarget(input: LeadingMarkInput): number | null {
  const { scrollLeft, restingX, markCenters, deadZone, topRowLeading } = input;
  if (markCenters.length === 0) return null;
  const leading = Math.min(...markCenters);
  const nearestEdge = clamp(leading, restingX - REST_BAND, restingX + REST_BAND);
  let wanted = scrollLeft + leading - nearestEdge;
  if (topRowLeading !== undefined) {
    wanted = Math.min(wanted, scrollLeft + topRowLeading - (restingX - REST_BAND));
  }
  const target = clamp(wanted, 0, input.maxScrollLeft);
  return Math.abs(target - scrollLeft) <= deadZone ? null : target;
}

const REST_BAND = 16;

function distanceToRange(value: number, start: number, end: number): number {
  if (value < start) return start - value;
  if (value > end) return value - end;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

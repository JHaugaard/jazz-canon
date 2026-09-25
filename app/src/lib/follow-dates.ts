export type FollowMode = 'active' | 'paused' | 'off';
export type FollowEvent = 'manual' | 'resume' | 'toggle-on' | 'toggle-off';

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

export function dateRangeWithMinimum(actualStart: number, actualEnd: number): [number, number] {
  return [Math.min(1945, actualStart), Math.max(1985, actualEnd)];
}

export function nextFollowMode(mode: FollowMode, event: FollowEvent): FollowMode {
  if (event === 'toggle-off') return 'off';
  if (event === 'toggle-on' || event === 'resume') return 'active';
  return mode === 'active' ? 'paused' : mode;
}

/** Select the row crossed by the reading line, falling back to the nearest
 * visible row that owns real marks. Empty rows never become pan targets. */
export function selectAnchorRow(
  rows: RowGeometry[],
  selectionLine: number,
  visibleTop: number,
  visibleBottom: number,
): string | null {
  const visible = rows.filter(
    (row) => row.markCount > 0 && row.bottom > visibleTop && row.top < visibleBottom,
  );
  if (visible.length === 0) return null;

  const crossed = visible.find((row) => row.top <= selectionLine && row.bottom > selectionLine);
  if (crossed) return crossed.id;

  return visible.reduce((best, row) => {
    const rowDistance = distanceToRange(selectionLine, row.top, row.bottom);
    const bestDistance = distanceToRange(selectionLine, best.top, best.bottom);
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

function distanceToRange(value: number, start: number, end: number): number {
  if (value < start) return start - value;
  if (value > end) return value - end;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

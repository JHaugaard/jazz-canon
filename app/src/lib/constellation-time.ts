import type { GraphData } from './types';

/* Pure time-lens helpers for the Constellation (Network.svelte), phase 1 of
 * docs/2026-11-03-constellation-sliding-window-spec.md. Album-year granularity
 * only (branch choice 1): a window is a closed range of calendar years, every
 * album in a year moves together, and nothing here knows about recording
 * sessions. No DOM, no fetch, no d3 — plain Node imports and verifies it
 * (constellation-time.test.mjs). */

/** Canon-wide year axis: the min/max `AlbumCard.year` of the loaded export,
 *  never hardcoded editorial dates, so the slider means the same year after
 *  any navigation. */
export interface YearBounds {
  min: number;
  max: number;
}

/** An active lens. `start`/`end` are inclusive calendar years, `width` is
 *  end - start + 1, and `center` is the slider year clamped into the bounds:
 *  always start ≤ center ≤ end. */
export interface TimeWindow {
  center: number;
  start: number;
  end: number;
  width: number;
}

/* Branch choice 2, fixed defaults: windows run 1..WINDOW_MAX_WIDTH years and
 * hold at most WINDOW_MAX_ALBUMS albums; a single year over budget keeps its
 * own one-year window (all albums in a calendar year stay together). */
export const WINDOW_MAX_WIDTH = 10;
export const WINDOW_MAX_ALBUMS = 8;

export interface AdaptiveWindowOptions {
  /** Widest window tried, in years. Default WINDOW_MAX_WIDTH. */
  maxWidth?: number;
  /** Album budget per window. Default WINDOW_MAX_ALBUMS. */
  maxAlbums?: number;
}

function yearOrThrow(label: string, v: number): number {
  if (!Number.isInteger(v)) throw new RangeError(`${label} must be an integer year, got ${v}`);
  return v;
}

/** Adaptive width (spec choice 2): the widest centered inclusive window, from
 *  1 through `maxWidth` years, holding at most `maxAlbums` of `years`.
 *
 *  - Widths are tried widest-first, so the first window that fits the budget is
 *    the widest one (clamped windows nest: a narrower width can never reach
 *    further than a wider one).
 *  - Centering: start = center - floor((w-1)/2), end = center + ceil((w-1)/2).
 *    Even widths put the extra year after the center.
 *  - Clamping: each edge clamps into `bounds` independently; `center` is
 *    clamped in first, so the window always contains it and never leaves the
 *    year axis (a center near an edge narrows its window instead).
 *  - Dense fallback: if even the one-year window is over budget, it is kept
 *    anyway — a calendar year is never split.
 *  - Non-integer entries in `years` cannot name a calendar year and are
 *    ignored. Empty `years` expands to the widest window.
 *  `years` is the current constellation's album years (fullAlbumIds → year),
 *  so the width adapts per musician/group as the spec requires. */
export function adaptiveTimeWindow(
  years: readonly number[],
  center: number,
  bounds: YearBounds,
  options: AdaptiveWindowOptions = {},
): TimeWindow {
  const maxWidth = options.maxWidth ?? WINDOW_MAX_WIDTH;
  const maxAlbums = options.maxAlbums ?? WINDOW_MAX_ALBUMS;
  yearOrThrow('center', center);
  yearOrThrow('bounds.min', bounds.min);
  yearOrThrow('bounds.max', bounds.max);
  if (bounds.min > bounds.max)
    throw new RangeError(`inverted bounds: min ${bounds.min} > max ${bounds.max}`);
  if (!Number.isInteger(maxWidth) || maxWidth < 1)
    throw new RangeError(`maxWidth must be an integer >= 1, got ${options.maxWidth}`);
  if (!Number.isInteger(maxAlbums) || maxAlbums < 1)
    throw new RangeError(`maxAlbums must be an integer >= 1, got ${options.maxAlbums}`);

  const c = Math.min(Math.max(center, bounds.min), bounds.max);

  // Albums per calendar year.
  const perYear = new Map<number, number>();
  for (const y of years) if (Number.isInteger(y)) perYear.set(y, (perYear.get(y) ?? 0) + 1);
  const count = (start: number, end: number): number => {
    let n = 0;
    for (const [y, k] of perYear) if (y >= start && y <= end) n += k;
    return n;
  };

  for (let w = maxWidth; w >= 1; w--) {
    const start = Math.max(c - Math.floor((w - 1) / 2), bounds.min);
    const end = Math.min(c + Math.ceil((w - 1) / 2), bounds.max);
    if (count(start, end) <= maxAlbums) return { center: c, start, end, width: end - start + 1 };
  }
  // Dense: even the one-year window is over budget — keep it.
  return { center: c, start: c, end: c, width: 1 };
}

export interface ConstellationFilterInput {
  /** The graph export. Edges for albums outside the constellation are ignored. */
  graph: GraphData;
  /** Selected musician ids (the constellation's own nodes). Never counted. */
  selectedIds: readonly string[];
  /** The full constellation's album ids — `groupQuery().albumIds` — in stable
   *  export order. The result preserves this order. */
  fullAlbumIds: readonly string[];
  /** Album id -> `AlbumCard.year`, year grade. An album without a year entry
   *  is visible at full range only (a window cannot place it in time). */
  albumYears: ReadonlyMap<string, number>;
  /** Active lens, or null for the full range (lens off). */
  window: TimeWindow | null;
}

export interface ConstellationFilterResult {
  /** Visible album ids, in `fullAlbumIds` order. */
  albumIds: string[];
  /** Per person id: shared albums inside the window — drives radius, edge
   *  width, repeat labels and Add-musician suggestions. */
  visibleShared: Map<string, number>;
  /** Per person id: shared albums across the whole constellation — the
   *  tooltip's overall count. Identical to `visibleShared` when the window is
   *  null (spec choice 6). */
  overallShared: Map<string, number>;
}

/** Filter the stable full-sky constellation down to a time window and count,
 *  per collaborator, the shared albums inside it and overall. One edge = one
 *  shared album, matching groupQuery's counting; selected musicians are
 *  excluded from both maps. Pure: same inputs, same answer, no state. */
export function filterConstellationWindow({
  graph,
  selectedIds,
  fullAlbumIds,
  albumYears,
  window,
}: ConstellationFilterInput): ConstellationFilterResult {
  const selected = new Set(selectedIds);

  const inWindow = (id: string): boolean => {
    if (window === null) return true; // full range: lens off
    const y = albumYears.get(id);
    return y !== undefined && y >= window.start && y <= window.end;
  };

  // The constellation's albums, deduped, in stable export order.
  const full: string[] = [];
  const fullSet = new Set<string>();
  for (const id of fullAlbumIds) {
    if (fullSet.has(id)) continue;
    fullSet.add(id);
    full.push(id);
  }

  const albumIds = full.filter(inWindow);

  const sharedWith = (albums: ReadonlySet<string>): Map<string, number> => {
    const m = new Map<string, number>();
    for (const e of graph.edges) {
      if (!albums.has(e.a) || selected.has(e.p)) continue;
      m.set(e.p, (m.get(e.p) ?? 0) + 1);
    }
    return m;
  };

  // A null window filters nothing, so both maps are built identically.
  return {
    albumIds,
    visibleShared: sharedWith(new Set(albumIds)),
    overallShared: sharedWith(fullSet),
  };
}
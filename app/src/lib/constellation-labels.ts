// Deterministic, pure album-label planner for the Constellation (Network.svelte).
//
// Geometry contract (mirrors Network.svelte as of branch constellation-dimming):
//   - node centre (x, y) and radius r are in graph (viewBox, pre-zoom) units;
//   - the album label hangs centred below its node: title baseline at r+16
//     (13px, weight 600), year baseline at r+30 (11px);
//   - labels live inside the zoom <g>, so by default they scale with zoom
//     ('graph' mode) and the plan is zoom-invariant apart from eligibility.
//     If the labels are later counter-scaled to a constant screen size, pass
//     labelScale: 'screen' and the current zoom k; label boxes then shrink by
//     1/k in graph units while their offset from the node rim stays fixed in
//     screen pixels.
//
// Rule: required labels (focused / hovered) are always placed. The remaining
// eligible labels are considered in priority order (more shared players,
// then earlier year, then title, then id) and each is placed only if its box
// does not intersect any already-placed box. The result is the
// lexicographically highest-priority collision-free subset; nothing is ever
// moved or overlapped to fit more labels in.

export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  r: number;
  /** Text exactly as rendered (already truncated by the caller). */
  title: string;
  year: number;
  /** Players shared with the selected musician(s); higher wins. */
  sharedPlayers: number;
  /** Whether this label may show at the current zoom level. */
  eligible: boolean;
  /** Focused/hovered: always placed, even if ineligible or colliding. */
  required?: boolean;
}

export interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlannedLabel {
  id: string;
  box: LabelBox;
  required: boolean;
}

export interface LabelPlan {
  /** Placed labels, in placement order (required first, then by priority). */
  placed: PlannedLabel[];
  /** Ids of placed labels, for O(1) lookups while rendering. */
  shown: Set<string>;
  /** Eligible, non-required labels dropped because of a collision. */
  suppressed: string[];
  /** Pairs of required labels that overlap each other (cannot be avoided). */
  requiredConflicts: [string, string][];
}

export interface PlanOptions {
  /** Current zoom scale; only used when labelScale is 'screen'. Default 1. */
  k?: number;
  /** 'graph' = labels scale with zoom (current rendering). Default 'graph'. */
  labelScale?: 'graph' | 'screen';
  /** Width in label units (px at k=1) of a rendered string at a font size. */
  measureText?: (text: string, fontPx: number) => number;
  titleFontPx?: number; // default 13 (--fs-md)
  yearFontPx?: number; // default 11 (--fs-xs)
  /** Box top, measured down from the node rim, in label units. Default 5. */
  topOffset?: number;
  /** Box height in label units (title + year lines). Default 28. */
  height?: number;
  /** Extra clearance added on every side of each box. Default 2. */
  padding?: number;
}

const DEFAULTS = {
  k: 1,
  labelScale: 'graph' as const,
  titleFontPx: 13,
  yearFontPx: 11,
  topOffset: 5,
  height: 28,
  padding: 2,
};

/** Deterministic width estimate; pass a canvas-backed measureText in the browser. */
export function estimateTextWidth(text: string, fontPx: number): number {
  return Array.from(text).length * fontPx * 0.58;
}

/** Priority comparator: negative means a outranks b. Total and deterministic. */
export function compareLabelPriority(a: LabelCandidate, b: LabelCandidate): number {
  return (
    b.sharedPlayers - a.sharedPlayers ||
    a.year - b.year ||
    (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function labelBox(c: LabelCandidate, options: PlanOptions = {}): LabelBox {
  const o = { ...DEFAULTS, ...options };
  const measure = options.measureText ?? estimateTextWidth;
  if (!(o.k > 0) || !Number.isFinite(o.k)) throw new RangeError('k must be a positive finite number');
  const s = o.labelScale === 'screen' ? 1 / o.k : 1; // label units -> graph units
  const width = Math.max(measure(c.title, o.titleFontPx), measure(String(c.year), o.yearFontPx));
  const half = (width / 2 + o.padding) * s;
  const top = c.y + c.r + (o.topOffset - o.padding) * s;
  return {
    left: c.x - half,
    right: c.x + half,
    top,
    bottom: top + (o.height + 2 * o.padding) * s,
  };
}

/** Strict overlap: boxes that only touch along an edge do not collide. */
export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function planAlbumLabels(candidates: readonly LabelCandidate[], options: PlanOptions = {}): LabelPlan {
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.id)) throw new Error(`duplicate label id: ${c.id}`);
    seen.add(c.id);
  }

  const required = candidates.filter((c) => c.required).sort(compareLabelPriority);
  const optional = candidates.filter((c) => !c.required && c.eligible).sort(compareLabelPriority);

  const placed: PlannedLabel[] = [];
  const requiredConflicts: [string, string][] = [];
  const suppressed: string[] = [];

  for (const c of required) {
    const box = labelBox(c, options);
    for (const p of placed) if (boxesOverlap(box, p.box)) requiredConflicts.push([p.id, c.id]);
    placed.push({ id: c.id, box, required: true });
  }
  for (const c of optional) {
    const box = labelBox(c, options);
    if (placed.some((p) => boxesOverlap(box, p.box))) suppressed.push(c.id);
    else placed.push({ id: c.id, box, required: false });
  }

  return { placed, shown: new Set(placed.map((p) => p.id)), suppressed, requiredConflicts };
}

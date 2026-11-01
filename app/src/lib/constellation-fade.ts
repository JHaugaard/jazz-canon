// Density- and zoom-adaptive resting opacities for the Constellation.
// Pure, deterministic and smooth: no thresholds, no hiding, no layout effect.
// Hover/tap focus is applied by the caller and overrides these values; the
// lit (focused) node/edge opacities (1 and .85) are deliberately not here.
//
// Model
//   1. Size. Album-equivalent size  S = albums + collaborators / 4.
//      A collaborator dot (r 13–28, small label) carries roughly a quarter of
//      an album node's visual weight (r 30 cover plus a two-line caption).
//   2. Zoom. Zooming in by z shows about 1/z² as much of the graph per screen
//      area, so the *perceived* size is  D = S / z²  (z = 1 at Reset).
//   3. Quietness. q = r / (1 + r), with r = (D / D_HALF) ^ STEEPNESS.
//      This is a logistic curve in log D: smooth, monotone, strictly inside
//      (0, 1). q ≈ 0 for tiny graphs, ≈ .53 for Paul Chambers at Reset,
//      → 1 for very large graphs.
//   4. Each output interpolates from its current "rich" value toward a quiet
//      floor that stays visible:  opacity = rich − (rich − floor) · q.
//
// Calibration (S = albums + collaborators/4, at Reset):
//   tiny graph (3 albums / 15 collaborators): one-off dots ≈ .35
//   Paul Chambers (37 / 123, S ≈ 68):         dots ≈ .20, one-off edges ≈ .03,
//                                             center spokes ≈ .20
//   ~100 albums / ~250 collaborators:         dots ≈ .12, one-off edges ≈ .018
//   ~250 albums / ~600 collaborators:         dots ≈ .08, one-off edges ≈ .011
//   Chambers zoomed 3×: back to ≈ .34 dots (near the small-graph look).

export const COLLABORATOR_WEIGHT = 0.25;
export const D_HALF = 61.7; // perceived size where q = 0.5
export const STEEPNESS = 1.437;
export const ZOOM_EXPONENT = 2; // perceived size ∝ 1 / zoom²
export const ZOOM_RATIO_MIN = 0.25;
export const ZOOM_RATIO_MAX = 8;

/** [rich (current small-graph value), quiet floor] for each output. */
export const FADE_RANGES = {
  oneOffDot: [0.36, 0.06],
  oneOffEdge: [0.056, 0.008], // rich = current .16 base × .35
  sharedEdge: [0.16, 0.04], // non-center, non-one-off edges (optional to use)
  centerEdge: [0.32, 0.1],
  unrelatedFocusNode: [0.12, 0.05],
  unrelatedFocusEdge: [0.025, 0.008],
} as const;

export interface FadeInput {
  albumCount: number;
  collaboratorCount: number;
  /** Current zoom ÷ Reset zoom: 1 at Reset, > 1 when zoomed in. */
  zoomRatio: number;
}

export interface FadeLevels {
  /** Album-equivalent size S = albums + collaborators / 4 (zoom-independent). */
  size: number;
  /** Perceived size D = S / zoomRatio² (zoom ratio clamped to [0.25, 8]). */
  perceivedSize: number;
  /** Quietness q in (0, 1): 0 = rich small-graph look, 1 = quiet floor. */
  quietness: number;
  oneOffDot: number;
  oneOffEdge: number;
  sharedEdge: number;
  centerEdge: number;
  unrelatedFocusNode: number;
  unrelatedFocusEdge: number;
}

function assertCount(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`${name} must be a finite number >= 0`);
}

export function quietnessFor(perceivedSize: number): number {
  if (perceivedSize <= 0) return 0;
  const r = Math.pow(perceivedSize / D_HALF, STEEPNESS);
  return r / (1 + r);
}

export function constellationFade(input: FadeInput): FadeLevels {
  const { albumCount, collaboratorCount, zoomRatio } = input;
  assertCount('albumCount', albumCount);
  assertCount('collaboratorCount', collaboratorCount);
  if (!Number.isFinite(zoomRatio) || zoomRatio <= 0) throw new RangeError('zoomRatio must be a positive finite number');

  const z = Math.min(ZOOM_RATIO_MAX, Math.max(ZOOM_RATIO_MIN, zoomRatio));
  const size = albumCount + collaboratorCount * COLLABORATOR_WEIGHT;
  const perceivedSize = size / Math.pow(z, ZOOM_EXPONENT);
  const q = quietnessFor(perceivedSize);
  const mix = ([rich, floor]: readonly [number, number]) => rich - (rich - floor) * q;

  return {
    size,
    perceivedSize,
    quietness: q,
    oneOffDot: mix(FADE_RANGES.oneOffDot),
    oneOffEdge: mix(FADE_RANGES.oneOffEdge),
    sharedEdge: mix(FADE_RANGES.sharedEdge),
    centerEdge: mix(FADE_RANGES.centerEdge),
    unrelatedFocusNode: mix(FADE_RANGES.unrelatedFocusNode),
    unrelatedFocusEdge: mix(FADE_RANGES.unrelatedFocusEdge),
  };
}

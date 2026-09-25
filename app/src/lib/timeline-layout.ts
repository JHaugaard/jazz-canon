import type { AlbumCard } from './types';

/* Timeline geometry. Every year from START to END gets a block on the
   x-axis: years with albums are wide enough for their card columns
   (albums stack vertically up to `perColumn`, then spill into a new
   column); empty years stay slim so gaps in the canon read as gaps.
   Era bands and the year axis both derive from the same x(year) map. */

export const START_YEAR = 1945;
export const END_YEAR = 1985;
export const OPEN_YEAR = 1965;

export const CARD_W = 148;
export const CARD_H = 214; // 148 art + text block
export const CARD_GAP = 14;
export const EMPTY_YEAR_W = 56;
export const YEAR_PAD = 26; // breathing room inside a populated year block

export interface PlacedCard {
  album: AlbumCard;
  x: number;
  y: number;
}

export interface YearBlock {
  year: number;
  x0: number;
  width: number;
  count: number;
}

export interface TimelineLayout {
  totalWidth: number;
  cards: PlacedCard[];
  years: YearBlock[];
  /** x of the start of a year's block; year END_YEAR+1 maps to the right edge */
  xOfYear: (year: number) => number;
}

export function computeLayout(albums: AlbumCard[], perColumn: number): TimelineLayout {
  const byYear = new Map<number, AlbumCard[]>();
  for (const a of albums) {
    if (!byYear.has(a.year)) byYear.set(a.year, []);
    byYear.get(a.year)!.push(a);
  }
  // stable order inside a year: artist then title
  for (const list of byYear.values()) {
    list.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  }

  const years: YearBlock[] = [];
  const cards: PlacedCard[] = [];
  const xStart = new Map<number, number>();
  let x = 0;

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const list = byYear.get(year) ?? [];
    const cols = list.length ? Math.ceil(list.length / perColumn) : 0;
    const width = list.length
      ? cols * CARD_W + (cols - 1) * CARD_GAP + YEAR_PAD * 2
      : EMPTY_YEAR_W;
    xStart.set(year, x);
    years.push({ year, x0: x, width, count: list.length });

    list.forEach((album, i) => {
      const col = Math.floor(i / perColumn);
      const row = i % perColumn;
      cards.push({
        album,
        x: x + YEAR_PAD + col * (CARD_W + CARD_GAP),
        y: row * (CARD_H + CARD_GAP),
      });
    });

    x += width;
  }

  const totalWidth = x;
  xStart.set(END_YEAR + 1, totalWidth);

  const xOfYear = (year: number) => {
    if (year <= START_YEAR) return 0;
    if (year > END_YEAR) return totalWidth;
    return xStart.get(year) ?? totalWidth;
  };

  return { totalWidth, cards, years, xOfYear };
}

/* Era bands (BRIEF §5.1). Overlaps are historically accurate and stay
   visible: each era gets its own horizontal lane, so coexisting eras
   read as parallel strips over the same span of years.

   Growth path: the canon will eventually extend toward the present
   (Free Jazz, Fusion, …). Adding an era = appending one entry here
   (plus a tint token in app.css) and, if needed, raising END_YEAR.
   Lane geometry is computed from the array — nothing else to touch. */
export interface EraBand {
  name: string;
  from: number;
  to: number; // inclusive last year
  cssVar: string;
}

/* Ordered by start year, so the overlap-blend runs chronologically down the
   lanes. Free Jazz and Fusion joined in 2026-07 when the genre gates opened
   (decision B2) — they are genres with genuine era shapes, so they belong in
   this framework. ECM does not appear here and never will: it is a record
   label, not an era, and shows up only as a card-level accent (gates.ts). */
export const ERA_BANDS: EraBand[] = [
  { name: 'Bebop', from: 1945, to: 1955, cssVar: 'var(--era-bebop)' },
  { name: 'Cool Jazz', from: 1949, to: 1958, cssVar: 'var(--era-cool)' },
  { name: 'Hard Bop', from: 1955, to: 1965, cssVar: 'var(--era-hardbop)' },
  { name: 'Modal Jazz', from: 1958, to: 1979, cssVar: 'var(--era-modal)' },
  { name: 'Free Jazz', from: 1959, to: 1979, cssVar: 'var(--era-freejazz)' },
  { name: 'Post-Bop', from: 1962, to: 1968, cssVar: 'var(--era-postbop)' },
  { name: 'Fusion', from: 1968, to: END_YEAR, cssVar: 'var(--era-fusion)' },
];

/** Overlapping lanes: each era's lane rises into the one above it by
 *  ~OVERLAP of a lane's height, so the translucent colors blend where the
 *  eras genuinely coexist. Returns percentages of the bands' vertical space. */
const OVERLAP = 0.2;
/** Keep the established floating labels over artwork/background, never over
 * album titles or artist names. Bounds include a little shadow clearance. */
export function eraLabelPositions(bandHeight: number, perColumn: number): number[] {
  const labelHeight = 30;
  const gap = 4;
  const metadata = Array.from({ length: perColumn }, (_, row) => ({
    start: 12 + row * (CARD_H + CARD_GAP) + 146,
    end: 12 + row * (CARD_H + CARD_GAP) + CARD_H,
  }));
  const positions: number[] = [];
  for (let i = 0; i < ERA_BANDS.length; i++) {
    const minimum = i ? positions[i - 1] + labelHeight + gap : 0;
    let top = Math.max(minimum, bandHeight * eraLane(i, ERA_BANDS.length).labelTop / 100 + 6);
    for (const text of metadata) {
      if (top < text.end + gap && top + labelHeight > text.start - gap) {
        const above = text.start - gap - labelHeight;
        top = above >= minimum ? above : text.end + gap;
      }
    }
    positions.push(top);
  }
  // A short viewport may require packing earlier labels upward to leave room
  // for the final one. Walk backward through the same metadata exclusions.
  for (let i = positions.length - 1; i >= 0; i--) {
    const maximum = i === positions.length - 1 ? bandHeight - labelHeight : positions[i + 1] - labelHeight - gap;
    let top = Math.min(positions[i], maximum);
    for (const text of [...metadata].reverse()) {
      if (top < text.end + gap && top + labelHeight > text.start - gap) top = text.start - gap - labelHeight;
    }
    positions[i] = top;
  }
  return positions;
}

export function eraLane(index: number, count: number): { top: number; height: number; labelTop: number } {
  const pad = 3; // % breathing room top and bottom
  const usable = 100 - pad * 2;
  // extent = laneH + (count-1)*step, where step = laneH*(1-OVERLAP)
  const laneH = usable / (1 + (count - 1) * (1 - OVERLAP));
  const step = laneH * (1 - OVERLAP);
  const top = pad + index * step;
  return {
    top,
    height: laneH,
    // drop the label into the lane's clean (single-color) middle zone,
    // below the strip its upper neighbour overlaps
    labelTop: top + laneH * (index === 0 ? 0.12 : OVERLAP + 0.12),
  };
}

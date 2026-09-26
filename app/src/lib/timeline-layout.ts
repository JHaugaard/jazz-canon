import type { AlbumCard } from './types';

/* Timeline geometry. Every year from START to END gets a block on the
   x-axis: years with albums are wide enough for their card columns
   (albums stack vertically up to `perColumn`, then spill into a new
   column); empty years stay slim so gaps in the canon read as gaps.
   The era ribbon and the year axis both derive from the same x(year) map. */

export const START_YEAR = 1945;
export const END_YEAR = 1985;
export const OPEN_YEAR = 1965;

export const CARD_W = 148;
export const CARD_H = 202; // 148 square cover + 54 text block
export const CARD_GAP = 12;
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

/* Era ribbon (BRIEF §5.1, reworked 2026-09-26 — D27). Each era is a thin
   rule in its own hue under the year axis, spanning its years, with its name
   pinned at the left end. Overlaps are historically accurate and stay
   visible: eras that coexist sit in parallel lanes. The eras used to be
   translucent bands behind the cards with floating labels; the labels sat on
   cover art, so the eras moved up into the axis.

   Growth path: the canon will eventually extend toward the present.
   Adding an era = appending one entry here (plus an --era-ink-* token in
   app.css) and, if needed, raising END_YEAR. Lanes are packed from the
   array — nothing else to touch. */
export interface EraBand {
  name: string;
  from: number;
  to: number; // inclusive last year
  cssVar: string; // solid era hue (line + label)
}

/* Ordered by start year. Free Jazz and Fusion joined in 2026-07 when the
   genre gates opened (decision B2) — they are genres with genuine era
   shapes, so they belong in this framework. ECM does not appear here and
   never will: it is a record label, shown only as a tag on the card. */
export const ERA_BANDS: EraBand[] = [
  { name: 'Bebop', from: 1945, to: 1955, cssVar: 'var(--era-ink-bebop)' },
  { name: 'Cool Jazz', from: 1949, to: 1958, cssVar: 'var(--era-ink-cool)' },
  { name: 'Hard Bop', from: 1955, to: 1965, cssVar: 'var(--era-ink-hardbop)' },
  { name: 'Modal Jazz', from: 1958, to: 1979, cssVar: 'var(--era-ink-modal)' },
  { name: 'Free Jazz', from: 1959, to: 1979, cssVar: 'var(--era-ink-freejazz)' },
  { name: 'Post-Bop', from: 1962, to: 1968, cssVar: 'var(--era-ink-postbop)' },
  { name: 'Fusion', from: 1968, to: END_YEAR, cssVar: 'var(--era-ink-fusion)' },
];

/** Greedy lane packing in start-year order: each era takes the first lane
 *  whose last era ended strictly before this one starts. `to` is inclusive,
 *  so Bebop (to 1955) and Hard Bop (from 1955) share a year and must not
 *  share a lane. Returns one lane index per band, in input order. */
export function eraLanes(bands: EraBand[] = ERA_BANDS): number[] {
  const laneEnds: number[] = [];
  return bands.map((band) => {
    let lane = laneEnds.findIndex((end) => end < band.from);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = band.to;
    return lane;
  });
}

/* Style code → era hue, for the style line under each cover. Offshoots take
   their parent era's hue (soul jazz → hard bop; jazz-rock → fusion). Codes
   not listed fall back to --muted in the card, never to a guessed era. */
export const STYLE_INK: Record<string, string> = {
  bebop: 'var(--era-ink-bebop)',
  'cool-jazz': 'var(--era-ink-cool)',
  'hard-bop': 'var(--era-ink-hardbop)',
  'soul-jazz': 'var(--era-ink-hardbop)',
  'modal-jazz': 'var(--era-ink-modal)',
  'spiritual-jazz': 'var(--era-ink-modal)',
  'post-bop': 'var(--era-ink-postbop)',
  'free-jazz': 'var(--era-ink-freejazz)',
  'avant-garde-jazz': 'var(--era-ink-freejazz)',
  'free-improvisation': 'var(--era-ink-freejazz)',
  fusion: 'var(--era-ink-fusion)',
  'jazz-rock': 'var(--era-ink-fusion)',
  'jazz-funk': 'var(--era-ink-fusion)',
};

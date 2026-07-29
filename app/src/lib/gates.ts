import type { AlbumCard } from './types';

/* The opened genre gates (canon decision 2026-07-28, amended 2026-07-29 —
   docs/2026-07-28-c1-swim-lanes-decision.md).

   Two things live here, and they are deliberately different:

   - Fusion and Free Jazz are GENRES with era shapes. They get era bands on
     the timeline canvas (see ERA_BANDS in timeline-layout.ts) *and* a card
     accent.
   - ECM is a LABEL, not a genre. It never gets a band. It appears only as a
     card accent, and a quieter one — its display weight reads smaller than a
     genre's, because a record earns its place here on musical continuity,
     not on imprint.

   A record's gate is read from its primary style code plus its secondary
   style tags. `ecm` can only ever arrive as a tag: the staging script refuses
   it as a primary style (LABEL_ONLY_STYLES in mccoy-tyner's
   scripts/stage-candidate.py). */

export type GateKey = 'fusion' | 'free-jazz' | 'ecm';

export interface Gate {
  key: GateKey;
  label: string;
  /** solid accent for card treatment */
  cssVar: string;
}

export const GATES: Gate[] = [
  { key: 'fusion', label: 'Fusion', cssVar: 'var(--gate-fusion)' },
  { key: 'free-jazz', label: 'Free Jazz', cssVar: 'var(--gate-freejazz)' },
  { key: 'ecm', label: 'ECM', cssVar: 'var(--gate-ecm)' },
];

/* Style code → gate. Mirrors the vocabulary table in the companion handoff
   (docs/2026-07-28-style-vocabulary-opened-gates.md). Codes absent here are
   tradition styles and carry no accent. */
const GATE_OF_STYLE: Record<string, GateKey> = {
  fusion: 'fusion',
  'jazz-rock': 'fusion',
  'jazz-funk': 'fusion',
  'free-jazz': 'free-jazz',
  'avant-garde-jazz': 'free-jazz',
  'free-improvisation': 'free-jazz',
  ecm: 'ecm',
};

/** Every gate a record arrives through, primary style first. */
export function gatesOf(album: AlbumCard): GateKey[] {
  const found: GateKey[] = [];
  for (const code of [album.styleCode, ...(album.styleTags ?? [])]) {
    const gate = GATE_OF_STYLE[code];
    if (gate && !found.includes(gate)) found.push(gate);
  }
  return found;
}

/** The gate that drives the card's top-edge accent: a genre gate always wins
 *  over the ECM label tag, so an ECM fusion record reads as fusion first. */
export function primaryGate(album: AlbumCard): GateKey | null {
  const gates = gatesOf(album);
  return gates.find((g) => g !== 'ecm') ?? gates[0] ?? null;
}

/* ── Gate filter — DEFERRED, not cancelled ────────────────────────────────
   Option C of the swim-lanes decision (filter chips that dim non-matching
   cards). Built and verified 2026-07-29, then pulled from the UI the same
   day: John's call was "nice touch, but not ready for that yet". The
   classification below is kept because it is the whole of the logic and it
   is already correct; only the chip bar was removed. Nothing calls it now.
   ─────────────────────────────────────────────────────────────────────── */

export type GateFilter = 'all' | 'tradition' | GateKey;

/** Filter test. 'tradition' is the complement of the gates: records that
 *  arrived before the gates opened, plus anything with no gate style. */
export function matchesFilter(album: AlbumCard, filter: GateFilter): boolean {
  if (filter === 'all') return true;
  const gates = gatesOf(album);
  if (filter === 'tradition') return gates.length === 0;
  return gates.includes(filter);
}

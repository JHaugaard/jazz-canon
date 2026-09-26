import type { AlbumCard } from './types';

/* Style search (look-and-feel pass, 2026-09-26 — D27). Styles are searched
   like places: a hit opens a list of every canon album in that style.

   The set of styles comes from the data (every primary style code and every
   style tag on albums.json). This table only adds display names and the
   spellings people actually type. A code that appears in the data but not
   here is still searchable, under the display name the export gives it. */

export interface StyleVocab {
  name: string;
  /** 'label' is ECM: a record-label tag, never a genre */
  kind: 'style' | 'label';
  aliases: string[];
}

export const STYLE_VOCAB: Record<string, StyleVocab> = {
  bebop: { name: 'Bebop', kind: 'style', aliases: ['be bop', 'be-bop', 'bop'] },
  'cool-jazz': { name: 'Cool Jazz', kind: 'style', aliases: ['cool', 'west coast', 'west coast jazz'] },
  'hard-bop': { name: 'Hard Bop', kind: 'style', aliases: ['hardbop', 'hard-bop'] },
  'soul-jazz': { name: 'Soul Jazz', kind: 'style', aliases: ['soul', 'organ jazz'] },
  'modal-jazz': { name: 'Modal Jazz', kind: 'style', aliases: ['modal'] },
  'post-bop': { name: 'Post-Bop', kind: 'style', aliases: ['post bop', 'postbop'] },
  'free-jazz': { name: 'Free Jazz', kind: 'style', aliases: ['free', 'the new thing', 'new thing'] },
  'avant-garde-jazz': { name: 'Avant-Garde Jazz', kind: 'style', aliases: ['avant garde', 'avant-garde', 'avantgarde', 'avant'] },
  'free-improvisation': { name: 'Free Improvisation', kind: 'style', aliases: ['free improv', 'improvisation'] },
  'spiritual-jazz': { name: 'Spiritual Jazz', kind: 'style', aliases: ['spiritual'] },
  fusion: { name: 'Fusion', kind: 'style', aliases: ['jazz fusion', 'electric jazz'] },
  'jazz-rock': { name: 'Jazz-Rock', kind: 'style', aliases: ['jazz rock'] },
  'jazz-funk': { name: 'Jazz-Funk', kind: 'style', aliases: ['jazz funk', 'funk'] },
  'european-jazz': { name: 'European Jazz', kind: 'style', aliases: ['european', 'euro jazz'] },
  ecm: { name: 'ECM', kind: 'label', aliases: ['ecm records'] },
};

export interface StyleEntry {
  code: string;
  name: string;
  kind: 'style' | 'label';
  /** albums whose primary style is this code */
  primary: AlbumCard[];
  /** albums that carry this code only as a secondary tag */
  tagged: AlbumCard[];
  keys: string[];
}

/** Every style present in the data, with its albums, oldest first. */
export function buildStyleIndex(albums: AlbumCard[]): StyleEntry[] {
  const byCode = new Map<string, StyleEntry>();
  const entry = (code: string, exportName: string | null): StyleEntry => {
    let e = byCode.get(code);
    if (!e) {
      const vocab = STYLE_VOCAB[code];
      const name = vocab?.name ?? exportName ?? code;
      e = { code, name, kind: vocab?.kind ?? 'style', primary: [], tagged: [], keys: [name, code, ...(vocab?.aliases ?? [])] };
      byCode.set(code, e);
    }
    return e;
  };
  for (const a of albums) {
    entry(a.styleCode, a.style).primary.push(a);
    for (const tag of a.styleTags ?? []) {
      if (tag !== a.styleCode) entry(tag, null).tagged.push(a);
    }
  }
  const byYear = (x: AlbumCard, y: AlbumCard) => x.year - y.year || x.artist.localeCompare(y.artist) || x.title.localeCompare(y.title);
  for (const e of byCode.values()) {
    e.primary.sort(byYear);
    e.tagged.sort(byYear);
  }
  return [...byCode.values()];
}

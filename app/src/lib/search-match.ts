// Case/diacritic-insensitive literal matching. No fuzzy search or city search;
// the only aliasing is the style vocabulary (styles.ts), matched by styleRank.
export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// 0: starts with query; 1: word-prefix; 2: literal substring.
export function rank(norm: string, query: string): number | null {
  if (norm.startsWith(query)) return 0;
  const at = norm.indexOf(query);
  if (at < 0) return null;
  return norm[at - 1] === ' ' ? 1 : 2;
}

/** Spacing-, hyphen- and case-insensitive form: "Be Bop" and "be-bop" both
 *  become "bebop"; "avant garde" and "Avant-Garde" both become "avantgarde". */
export const compact = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');

/** Best rank of the query against a style's name and aliases, or null.
 *  Uses the same 0/1/2 ranks as every other search group, checked twice: on
 *  the folded text (keeps word-prefix ranking) and on the compact form
 *  (so spacing and hyphens never decide a match). */
export function styleRank(keys: string[], query: string): number | null {
  const q = fold(query.trim());
  const qc = compact(query);
  if (!qc) return null;
  let best: number | null = null;
  for (const key of keys) {
    for (const r of [rank(fold(key), q), rank(compact(key), qc)]) {
      if (r !== null && (best === null || r < best)) best = r;
    }
  }
  return best;
}

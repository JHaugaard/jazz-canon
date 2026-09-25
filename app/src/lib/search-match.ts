// Case/diacritic-insensitive literal matching. No aliasing, fuzzy search or city search.
export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// 0: starts with query; 1: word-prefix; 2: literal substring.
export function rank(norm: string, query: string): number | null {
  if (norm.startsWith(query)) return 0;
  const at = norm.indexOf(query);
  if (at < 0) return null;
  return norm[at - 1] === ' ' ? 1 : 2;
}

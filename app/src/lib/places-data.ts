import type { Place, PlaceAlbumRef } from './types';

/* Pure derivation over the ratified places.json — no DOM, no fetch, so it
   runs under plain Node for verification. All indexes are built once at
   load time; the UI hardcodes nothing (no ids, no counts, no regions). */

/* Vite replaces import.meta.env at build time; under plain Node it is
   undefined. The cast keeps this file typecheckable without vite/client
   ambient types. */
export const DEV: boolean =
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;

export interface AlbumPlace {
  place: Place;
  ref: PlaceAlbumRef;
}

export interface PlacesData {
  places: Place[];
  byId: Map<string, Place>;
  byAlbum: Map<string, AlbumPlace[]>;
}

export function buildPlacesData(raw: Place[]): PlacesData {
  /* merged-* slugs never export by contract; filter defensively. */
  const places = raw.filter((p) => {
    if (p.id.startsWith('merged-')) {
      if (DEV) console.warn(`places.json: unexpected merged slug "${p.id}" — filtered`);
      return false;
    }
    return true;
  });
  const byId = new Map(places.map((p) => [p.id, p]));
  const byAlbum = new Map<string, AlbumPlace[]>();
  for (const place of places) {
    for (const ref of place.albums) {
      const list = byAlbum.get(ref.albumId) ?? [];
      list.push({ place, ref });
      byAlbum.set(ref.albumId, list);
    }
  }
  return { places, byId, byAlbum };
}

/* Comparable key for one date string. ISO day-precision stays as-is;
   any other string keys as its leading 4-digit year; a string with no
   leading year returns null (dead code by contract, guard kept
   deliberately). Plain string compare orders keys correctly:
   "1959" < "1959-03-06" < "1960". */
export function dateKey(s: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return iso[0];
  const yr = /^\d{4}/.exec(s);
  return yr ? yr[0] : null;
}

/* Sort key for an album's presence at a place: its earliest session date
   there; entries with no usable date key by the canon year. */
export function sessionSortKey(ref: PlaceAlbumRef): string {
  const keys = ref.dates.map(dateKey).filter((k): k is string => k !== null);
  return keys.length ? keys.sort()[0] : String(ref.year);
}

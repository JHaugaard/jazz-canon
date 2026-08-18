# Places in the Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mini-map to the album card showing where each album was recorded, with pins that open a floating Place window listing every canon album recorded at that place.

**Architecture:** Pure-TypeScript Web Mercator geometry (no mapping library) renders a committed, pre-clipped basemap asset as inline SVG inside `DeepDive.svelte`. A new `PlaceWindow.svelte` reuses the Constellation's window chrome, extracted into a shared `FloatingWindow.svelte`. All data derives at load time from the ratified `places.json` (46 places) plus the site-authored basemap; nothing place-specific is hardcoded in app code.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite 8, plain SVG. Node 24 (native TS execution) for authoring-time scripts and verification harnesses. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-17-places-in-the-card-design.md` — the authority when this plan is ambiguous.

## Global Constraints

- **Zero new npm dependencies** (runtime or dev). `d3-geo` will NOT be added. The only D3 package stays `d3-force`.
- **No schema or export changes.** `app/public/data/places.json` is consumed read-only; `details.studios` stays in the export unchanged.
- **Basemap budget: ≤ 250 KB gzipped**, hard-fail in the authoring script (exit 1, nothing written) — never silently trim.
- **Light scheme only.** Site palette variables from `app.css` (`--bg #faf8f3`, `--surface`, `--ink`, `--muted`, `--line`, `--bn-blue #2b5f7a`, `--bn-blue-light`, `--impulse-amber #c4862a`). Oswald small-caps (`var(--font-display)`) for place labels; Lora (body default) for captions. The palette has no red — don't introduce one.
- **No pan, no zoom, no hover-dependent information, no tiles, no external map services, no keys.**
- **UI hardcodes nothing from the data**: no place ids, no counts, no region lists in app code. (Region bboxes live in the committed basemap asset, authored by the script — that's the documented authoring tool, not app code.)
- **Absence of a pin must never read as "recorded nowhere"**: placeless albums keep the existing `Studio` text row exactly as now.
- **No silent fallbacks**: load failures render a one-line error naming the failed file; contract violations are skipped with a dev-mode console warning naming ids.
- **Behavior-preserving Constellation refactor**: after the `FloatingWindow` extraction, drag, resize, and phone full-screen must be unchanged (verification gate 6).
- `npm run check` (svelte-check + tsc, run from `app/`) must be clean at every commit.
- Work on branch `studios`. Commit per task. **Never push** — deploys are John-only.
- End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Repo facts you need (verified 2026-08-17)

- App lives in `app/` (Vite + Svelte 5, `type: module`). Components in `app/src/lib/`. Static data in `app/public/data/`. Authoring scripts in `scripts/` (house pattern: plain `.mjs` with a header comment, see `scripts/enrich-previews.mjs`).
- **There is no test suite and none may be added** (no-new-deps). Verification is: `npm run check`, Node-run harnesses for pure modules (Node v24 executes `.ts` files directly — type annotations are stripped natively), and behavioral probes against the real app via playwright-core installed in the *session scratchpad*, never in the repo. Recipe: `cd app && npm run build && npm run preview -- --port 4173` for prod probes, `npm run dev -- --port 5173` for probes needing the dev-only nav hook; launch `chromium.launch({ executablePath: '<home>/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] })`.
- `places.json`: array of 46 places `{id, name, kind, city, lat, lon, precision, albums:[{albumId, year, dates[]}]}`. Kinds: studio 27 / club 10 / home 3 / other 3 / hall 2 / festival 1. Precision: address 33 / city 13. Extents: lat 33.768–59.913, lon −122.42–10.74. All 146 distinct `albumId`s resolve against `albums.json` (151 albums; the other 5 are the placeless ones).
- Useful concrete ids: `van-gelder-studio-englewood-cliffs` (59 albums), `van-gelder-studio-hackensack` (13), `cbs-30th-street-studio` + `columbia-records-hollywood-studio-columbia-square` (the two Seven Steps pins), `sound-makers-studios` + `nola-penthouse-sound-studios` (same Manhattan block), `cbs-studios-new-york` (city-grade). Do not hardcode these in app code — they're for verification only.
- Untracked by design: `app/public/data/places.json` rides the first build commit (Task 1). Leave `docs/2026-08-17-places-on-site-brief.md` and `.docs/` alone — John decides those.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/types.ts` | modify | `Place`, `PlaceKind`, `PlacePrecision`, `PlaceAlbumRef` types; `NavEntry` gains `place` kind (Task 5) |
| `app/src/lib/places-data.ts` | create | Pure data derivation: validate/filter, inversion index, session-date sort keys. No DOM, node-runnable |
| `app/src/lib/data.ts` | modify | `loadPlaces()` and `loadBasemap()` cached-promise loaders (same pattern as `loadAlbums`) |
| `app/src/lib/places-geo.ts` | create | Pure Web Mercator geometry: projection, bbox fit, extent rules, region choice, SVG paths, pin spreading. No DOM, node-runnable |
| `scripts/build-basemap.mjs` | create | Authoring-time: Natural Earth → clipped/simplified per-region basemap JSON, budget-enforced |
| `app/public/map/basemap.json` | create (generated) | Committed basemap asset (in `/map/`, not `/data/` — `/data/` stays platform-export-only) |
| `app/src/lib/FloatingWindow.svelte` | create | Shared draggable/resizable window chrome (extracted from `App.svelte`) |
| `app/src/lib/PlaceWindow.svelte` | create | Place window body: header meta + date-sorted album list |
| `app/src/lib/MiniMap.svelte` | create | The album card's mini-map: basemap layers, pins, labels, caption |
| `app/src/lib/nav.svelte.ts` | modify | `openPlace(id)`; dev-only `window.__nav` test seam |
| `app/src/lib/DeepDive.svelte` | modify | Studio row ⇄ mini-map logic + error line |
| `app/src/App.svelte` | modify | Constellation moves into `FloatingWindow`; new `place` branch; shared chrome CSS moves to `app.css` |
| `app/src/app.css` | modify | Receives `.panel-bar` / `.nav-btn` / `.panel-body` rules (shared chrome) |
| `.gitignore` | modify | `scripts/.ne-cache/` |

Verification harnesses (`verify-places-data.ts`, `verify-places-geo.ts`, `probe-*.mjs`) live in the **session scratchpad**, never the repo.

---

### Task 1: Places data layer

**Files:**
- Modify: `app/src/lib/types.ts` (append after `RecentAddition`)
- Create: `app/src/lib/places-data.ts`
- Modify: `app/src/lib/data.ts`
- Commit alongside: `app/public/data/places.json` (already on disk, untracked)

**Interfaces:**
- Consumes: `places.json` contract (shape above).
- Produces: types `Place`, `PlaceKind`, `PlacePrecision`, `PlaceAlbumRef` (types.ts); `PlacesData { places, byId: Map<string, Place>, byAlbum: Map<string, AlbumPlace[]> }`, `AlbumPlace { place: Place; ref: PlaceAlbumRef }`, `buildPlacesData(raw: Place[]): PlacesData`, `sessionSortKey(ref: PlaceAlbumRef): string`, `dateKey(s: string): string | null`, `const DEV: boolean` (places-data.ts); `loadPlaces(): Promise<PlacesData>` (data.ts). Later tasks import exactly these names.

- [ ] **Step 1: Write the failing verification harness** — save to `<scratchpad>/verify-places-data.ts`:

```ts
/* Verification harness for places-data.ts. Run: node verify-places-data.ts */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildPlacesData, sessionSortKey, dateKey } from '/home/john/dev/active/jazz-canon/app/src/lib/places-data.ts';
import type { Place } from '/home/john/dev/active/jazz-canon/app/src/lib/types.ts';

const raw: Place[] = JSON.parse(
  fs.readFileSync('/home/john/dev/active/jazz-canon/app/public/data/places.json', 'utf8'),
);
const pd = buildPlacesData(raw);

// counts derive from the file itself — never hardcode beyond what the file says today
assert.equal(pd.places.length, raw.length, 'no places dropped from a clean file');
const distinctAlbumIds = new Set(raw.flatMap((p) => p.albums.map((a) => a.albumId)));
assert.equal(pd.byAlbum.size, distinctAlbumIds.size, 'inversion covers every placed album');

// the spec's trap case: Seven Steps to Heaven → two places, correct per-place dates
const seven = pd.byAlbum.get('miles-davis-seven-steps-to-heaven-1963');
assert.ok(seven && seven.length === 2, 'Seven Steps has exactly two places');
const byPlace = new Map(seven!.map((e) => [e.place.id, e.ref]));
assert.deepEqual(byPlace.get('cbs-30th-street-studio')!.dates, ['1963-05-14']);
assert.deepEqual(byPlace.get('columbia-records-hollywood-studio-columbia-square')!.dates, [
  '1963-04-16',
  '1963-04-17',
]);

// date semantics per contract
assert.equal(dateKey('1963-04-16'), '1963-04-16', 'ISO day precision kept');
assert.equal(dateKey('1959 spring'), '1959', 'leading-year string is year-grade');
assert.equal(dateKey('December 10 & 15'), null, 'no leading year → guard fires (dead code by contract)');
assert.equal(
  sessionSortKey({ albumId: 'x', year: 1961, dates: [] }),
  '1961',
  'empty dates[] falls back to the entry year',
);
assert.equal(
  sessionSortKey({ albumId: 'x', year: 1961, dates: ['December 10 & 15'] }),
  '1961',
  'all-unparseable dates fall back to the entry year',
);
assert.equal(
  sessionSortKey({ albumId: 'x', year: 1963, dates: ['1963-05-14', '1963-04-16'] }),
  '1963-04-16',
  'earliest date wins',
);
// string keys sort correctly: year-grade sorts before day-grade within the year
assert.ok('1959' < '1959-03-06' && '1959-03-06' < '1960');

// merged-* slugs (contract says they never export) are filtered defensively
const withMerged = [...raw, { ...raw[0], id: 'merged-ghost' }];
assert.equal(buildPlacesData(withMerged).places.length, raw.length, 'merged-* filtered');
assert.equal(buildPlacesData(withMerged).byId.has('merged-ghost'), false);

console.log('verify-places-data: ALL PASS');
```

- [ ] **Step 2: Run it, confirm it fails** — `node <scratchpad>/verify-places-data.ts` → expect `Cannot find module … places-data.ts`.

- [ ] **Step 3: Append the place types** to `app/src/lib/types.ts`:

```ts
/* ---- Places (ratified places.json contract, 2026-08-14) ---------------- */

export type PlaceKind = 'studio' | 'club' | 'home' | 'hall' | 'festival' | 'other';
export type PlacePrecision = 'address' | 'city';

export interface PlaceAlbumRef {
  albumId: string;
  year: number;
  /* Session-date strings. Contract: each leads with a 4-digit year; ISO
     day precision when known; non-ISO strings are year-grade. Empty means
     "use `year`". */
  dates: string[];
}

export interface Place {
  id: string; // name_slug, stable across exports
  name: string;
  kind: PlaceKind;
  city: string;
  lat: number;
  lon: number;
  /* "address" = exact dot (block/street grade included); "city" = soft
     halo — geographic epistemic honesty, never render a soft location as
     an exact point. */
  precision: PlacePrecision;
  albums: PlaceAlbumRef[];
}
```

- [ ] **Step 4: Create `app/src/lib/places-data.ts`:**

```ts
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
```

- [ ] **Step 5: Add the loader to `app/src/lib/data.ts`** — extend the type import and add below `loadRecentlyAdded`:

```ts
// top of file: extend the existing type import
import type { AlbumCard, AlbumDetail, GraphData, RecentAddition, Place } from './types';
import { buildPlacesData, type PlacesData } from './places-data';

// with the other module-level promise slots:
let placesPromise: Promise<PlacesData> | null = null;

// below loadRecentlyAdded():
export function loadPlaces(): Promise<PlacesData> {
  return (placesPromise ??= fetchJson<Place[]>('/data/places.json').then(buildPlacesData));
}
```

- [ ] **Step 6: Run the harness, confirm it passes** — `node <scratchpad>/verify-places-data.ts` → `verify-places-data: ALL PASS`.

- [ ] **Step 7: Static gate** — `cd app && npm run check` → 0 errors, 0 warnings from the new code.

- [ ] **Step 8: Commit** (places.json rides this commit, per standing decision):

```bash
cd /home/john/dev/active/jazz-canon
git add app/src/lib/types.ts app/src/lib/places-data.ts app/src/lib/data.ts app/public/data/places.json
git commit -m "Places data layer: types, inversion index, session-date keys (places.json lands)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Web Mercator geometry module

**Files:**
- Create: `app/src/lib/places-geo.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure module).
- Produces: `LonLat {lon, lat}`, `Bbox {west, south, east, north}`, `Viewport {width, height}`, `Transform {scale, tx, ty}`, `BasemapRegion {id, bbox: Bbox, land: number[][][], lakes: number[][][], borders: number[][][]}`, `Basemap {regions: BasemapRegion[]}`; functions `mercX`, `mercY`, `fitBbox(bbox, vp, padding): Transform`, `project(p: LonLat, t: Transform): {x, y}`, `pinsBbox(pins: LonLat[]): Bbox`, `expandBbox(b, ratio): Bbox`, `ensureMinExtent(b, minWidthKm, aspect): Bbox`, `metroExtent(pin, widthKm, aspect): Bbox`, `bboxContains(b, p): boolean`, `chooseRegion(pins, regions): BasemapRegion | null`, `ringPath(ring: number[][], t): string`, `linePath(line: number[][], t): string`, `spreadPins(pts: {x,y}[], minGap?): {x,y}[]`. Tasks 3 and 6 use these exact names; coordinates in basemap layers are `[lon, lat]` pairs.

- [ ] **Step 1: Write the failing harness** — `<scratchpad>/verify-places-geo.ts`:

```ts
/* Verification harness for places-geo.ts. Run: node verify-places-geo.ts */
import assert from 'node:assert/strict';
import {
  mercX, mercY, fitBbox, project, pinsBbox, expandBbox, ensureMinExtent,
  metroExtent, bboxContains, chooseRegion, ringPath, linePath, spreadPins,
} from '/home/john/dev/active/jazz-canon/app/src/lib/places-geo.ts';
import type { BasemapRegion } from '/home/john/dev/active/jazz-canon/app/src/lib/places-geo.ts';

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`);

// projection identities
close(mercX(0), 0); close(mercY(0), 0);
close(mercX(180), Math.PI);
close(mercY(85), Math.log(Math.tan(Math.PI / 4 + (85 * Math.PI) / 180 / 2)));

// fit: bbox center projects to viewport center; padding respected
const vp = { width: 640, height: 400 };
const bb = { west: -74.5, south: 40.3, east: -73.5, north: 41.1 };
const t = fitBbox(bb, vp, 16);
const c = project({ lon: (bb.west + bb.east) / 2, lat: 0 }, t);
close(c.x, 320, 1e-6); // horizontal center (Mercator x is linear in lon)
const nw = project({ lon: bb.west, lat: bb.north }, t);
const se = project({ lon: bb.east, lat: bb.south }, t);
assert.ok(nw.x >= 15.99 && nw.y >= 15.99, 'padding kept top-left');
assert.ok(se.x <= vp.width - 15.99 && se.y <= vp.height - 15.99, 'padding kept bottom-right');
assert.ok(se.x > nw.x && se.y > nw.y, 'y grows southward (screen coords)');

// metro window: ~60 km wide at the pin's latitude, aspect preserved
const m = metroExtent({ lon: -73.985, lat: 40.885 }, 60, 1.6);
const widthKm = (m.east - m.west) * 111.32 * Math.cos((40.885 * Math.PI) / 180);
close(widthKm, 60, 0.5);
assert.ok(bboxContains(m, { lon: -73.985, lat: 40.885 }), 'pin centered in window');

// minimum extent applies to multi-pin bboxes too
const tiny = pinsBbox([{ lon: -73.978, lat: 40.765 }, { lon: -73.977, lat: 40.766 }]);
const grown = ensureMinExtent(expandBbox(tiny, 0.25), 60, 1.6);
const grownKm = (grown.east - grown.west) * 111.32 * Math.cos((40.765 * Math.PI) / 180);
assert.ok(grownKm >= 59.5, `min extent enforced (${grownKm} km)`);

// region choice: smallest containing bbox wins; nothing containing → null
const regions: BasemapRegion[] = [
  { id: 'nyc', bbox: { west: -75, south: 40, east: -72.4, north: 41.4 }, land: [], lakes: [], borders: [] },
  { id: 'continental-us', bbox: { west: -125.5, south: 24, east: -66.5, north: 49.8 }, land: [], lakes: [], borders: [] },
];
assert.equal(chooseRegion([{ lon: -73.98, lat: 40.76 }], regions)!.id, 'nyc');
assert.equal(
  chooseRegion([{ lon: -73.98, lat: 40.76 }, { lon: -118.33, lat: 34.1 }], regions)!.id,
  'continental-us',
);
assert.equal(chooseRegion([{ lon: 10.75, lat: 59.91 }], regions), null, 'Oslo outside both → null');

// svg paths
const sq = ringPath([[0, 0], [10, 0], [10, 10], [0, 10]], { scale: 1, tx: 0, ty: 0 });
assert.ok(sq.startsWith('M') && sq.endsWith('Z') && sq.split('L').length === 4, `ring path: ${sq}`);
const ln = linePath([[0, 0], [10, 0]], { scale: 1, tx: 0, ty: 0 });
assert.ok(ln.startsWith('M') && !ln.endsWith('Z'), 'line path open');

// pin spreading: coincident pins separate; centroid preserved; far pins untouched
const spread = spreadPins([{ x: 100, y: 100 }, { x: 100, y: 100 }], 12);
const d = Math.hypot(spread[0].x - spread[1].x, spread[0].y - spread[1].y);
assert.ok(d >= 11.9, `coincident pins separated (${d}px)`);
close((spread[0].x + spread[1].x) / 2, 100, 0.01);
const far = spreadPins([{ x: 0, y: 0 }, { x: 200, y: 0 }], 12);
close(far[0].x, 0); close(far[1].x, 200);

console.log('verify-places-geo: ALL PASS');
```

- [ ] **Step 2: Run it, confirm it fails** — `node <scratchpad>/verify-places-geo.ts` → `Cannot find module … places-geo.ts`.

- [ ] **Step 3: Create `app/src/lib/places-geo.ts`:**

```ts
/* Pure Web Mercator mini-map geometry — no DOM, no dependencies, so it
   runs under plain Node for verification. Forward projection only; at
   metro-to-continental extents against a pre-clipped asset there is no
   clipping or resampling to do here. */

export interface LonLat { lon: number; lat: number }
export interface Bbox { west: number; south: number; east: number; north: number }
export interface Viewport { width: number; height: number }
export interface Transform { scale: number; tx: number; ty: number }

/* One region of the committed basemap asset. Layer coordinates are
   [lon, lat] pairs: land/lakes are arrays of rings, borders are arrays
   of polylines. */
export interface BasemapRegion {
  id: string;
  bbox: Bbox;
  land: number[][][];
  lakes: number[][][];
  borders: number[][][];
}
export interface Basemap { regions: BasemapRegion[] }

const RAD = Math.PI / 180;

export function mercX(lon: number): number {
  return lon * RAD;
}
export function mercY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
}

/* Fit a lon/lat bbox into a pixel viewport with uniform padding,
   preserving aspect. Screen y grows downward:
   px = tx + scale·mercX(lon), py = ty − scale·mercY(lat). */
export function fitBbox(bbox: Bbox, vp: Viewport, padding: number): Transform {
  const x0 = mercX(bbox.west), x1 = mercX(bbox.east);
  const y0 = mercY(bbox.south), y1 = mercY(bbox.north);
  const scale = Math.min(
    (vp.width - 2 * padding) / (x1 - x0),
    (vp.height - 2 * padding) / (y1 - y0),
  );
  return {
    scale,
    tx: vp.width / 2 - (scale * (x0 + x1)) / 2,
    ty: vp.height / 2 + (scale * (y0 + y1)) / 2,
  };
}

export function project(p: LonLat, t: Transform): { x: number; y: number } {
  return { x: t.tx + t.scale * mercX(p.lon), y: t.ty - t.scale * mercY(p.lat) };
}

export function pinsBbox(pins: LonLat[]): Bbox {
  return {
    west: Math.min(...pins.map((p) => p.lon)),
    east: Math.max(...pins.map((p) => p.lon)),
    south: Math.min(...pins.map((p) => p.lat)),
    north: Math.max(...pins.map((p) => p.lat)),
  };
}

export function expandBbox(b: Bbox, ratio: number): Bbox {
  const dw = (b.east - b.west) * ratio;
  const dh = (b.north - b.south) * ratio;
  return { west: b.west - dw, east: b.east + dw, south: b.south - dh, north: b.north + dh };
}

export function kmToLonDeg(km: number, lat: number): number {
  return km / (111.32 * Math.cos(lat * RAD));
}
export function kmToLatDeg(km: number): number {
  return km / 110.574;
}

/* Grow a bbox (about its center) until it is at least minWidthKm wide and
   the matching height for `aspect` (w/h). A tight cluster never gets a
   tight frame. */
export function ensureMinExtent(b: Bbox, minWidthKm: number, aspect: number): Bbox {
  const midLat = (b.south + b.north) / 2;
  const minW = kmToLonDeg(minWidthKm, midLat);
  const minH = kmToLatDeg(minWidthKm / aspect);
  const cx = (b.west + b.east) / 2, cy = midLat;
  const w = Math.max(b.east - b.west, minW);
  const h = Math.max(b.north - b.south, minH);
  return { west: cx - w / 2, east: cx + w / 2, south: cy - h / 2, north: cy + h / 2 };
}

/* Single pin: a fixed metro window centered on it. */
export function metroExtent(pin: LonLat, widthKm: number, aspect: number): Bbox {
  const w = kmToLonDeg(widthKm, pin.lat);
  const h = kmToLatDeg(widthKm / aspect);
  return {
    west: pin.lon - w / 2, east: pin.lon + w / 2,
    south: pin.lat - h / 2, north: pin.lat + h / 2,
  };
}

export function bboxContains(b: Bbox, p: LonLat): boolean {
  return p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;
}

/* The smallest region whose bbox contains every pin; null when none does
   (the coverage-honesty path: render pins on paper, warn in dev). */
export function chooseRegion(pins: LonLat[], regions: BasemapRegion[]): BasemapRegion | null {
  const area = (b: Bbox) => (mercX(b.east) - mercX(b.west)) * (mercY(b.north) - mercY(b.south));
  const containing = regions.filter((r) => pins.every((p) => bboxContains(r.bbox, p)));
  if (!containing.length) return null;
  return containing.sort((a, b) => area(a.bbox) - area(b.bbox))[0];
}

const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

export function ringPath(ring: number[][], t: Transform): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const p = project({ lon, lat }, t);
        return `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
      })
      .join('') + 'Z'
  );
}

export function linePath(line: number[][], t: Transform): string {
  return line
    .map(([lon, lat], i) => {
      const p = project({ lon, lat }, t);
      return `${i ? 'L' : 'M'}${fmt(p.x)} ${fmt(p.y)}`;
    })
    .join('');
}

/* Display-only de-overlap for pins that coincide at mini-map scale
   (Sound Makers and Nola share a block; five city-grade NYC places share
   one coordinate). Symmetric pairwise repulsion along the connecting
   axis — deterministic, centroid-preserving, data untouched. Never drop
   a pin. */
export function spreadPins(
  pts: { x: number; y: number }[],
  minGap = 12,
): { x: number; y: number }[] {
  const out = pts.map((p) => ({ ...p }));
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x, dy = out[j].y - out[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        moved = true;
        const ux = d < 1e-6 ? 1 : dx / d;
        const uy = d < 1e-6 ? 0 : dy / d;
        const push = (minGap - d) / 2;
        out[i].x -= ux * push; out[i].y -= uy * push;
        out[j].x += ux * push; out[j].y += uy * push;
      }
    }
    if (!moved) break;
  }
  return out;
}
```

- [ ] **Step 4: Run the harness, confirm it passes** — `node <scratchpad>/verify-places-geo.ts` → `verify-places-geo: ALL PASS`.

- [ ] **Step 5: Static gate** — `cd app && npm run check` → clean.

- [ ] **Step 6: Commit:**

```bash
git add app/src/lib/places-geo.ts
git commit -m "places-geo: Web Mercator projection, extent rules, pin spreading (pure module)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Basemap authoring script + committed asset

**Files:**
- Create: `scripts/build-basemap.mjs`
- Create (generated): `app/public/map/basemap.json`
- Modify: `.gitignore` (add `scripts/.ne-cache/`), `app/src/lib/data.ts` (add `loadBasemap`)

**Interfaces:**
- Consumes: `Basemap` / `BasemapRegion` shape from Task 2 (the script emits exactly it, in plain JS); `app/public/data/places.json` for coverage validation.
- Produces: `/map/basemap.json` served asset; `loadBasemap(): Promise<Basemap>` in data.ts. Task 6 consumes both.

- [ ] **Step 1: Create `scripts/build-basemap.mjs`:**

```js
// Build the committed mini-map basemap from Natural Earth 10m GeoJSON.
// Authoring-time tool — not part of the runtime or build. Re-run only to
// extend coverage or retune fidelity; the output is committed.
//
//   node scripts/build-basemap.mjs
//
// Downloads (cached in scripts/.ne-cache/, gitignored) → clips each layer
// to per-region bboxes (Sutherland–Hodgman for rings, inside-run splitting
// for lines) → Douglas–Peucker simplification → rounded coords → single
// JSON at app/public/map/basemap.json. HARD BUDGET: ≤ 250 KB gzipped.
// Over budget or a pin outside every region → exit 1, nothing written.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.ne-cache');
const OUT = path.join(ROOT, 'app', 'public', 'map', 'basemap.json');
const BUDGET = 250 * 1024;

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const SOURCES = {
  land: 'ne_10m_land.geojson',
  lakes: 'ne_10m_lakes.geojson',
  states: 'ne_10m_admin_1_states_provinces_lines.geojson',
  countries: 'ne_10m_admin_0_boundary_lines_land.geojson',
};

// Region bboxes are sized so a single-pin 120 km city-grade window at any
// covered pin stays inside the region. [west, south, east, north].
// tol = Douglas–Peucker tolerance (deg), dec = coordinate decimals.
const REGIONS = [
  { id: 'nyc',            bbox: [-75.0, 40.0, -72.4, 41.4],  tol: 0.0006, dec: 4 },
  { id: 'la',             bbox: [-119.2, 33.2, -117.4, 34.7], tol: 0.0006, dec: 4 },
  { id: 'sf-monterey',    bbox: [-123.2, 36.0, -121.0, 38.5], tol: 0.0008, dec: 4 },
  { id: 'chicago',        bbox: [-88.6, 41.2, -86.6, 42.6],   tol: 0.0008, dec: 4 },
  { id: 'oslo',           bbox: [9.5, 59.2, 12.0, 60.6],      tol: 0.0008, dec: 4 },
  { id: 'stuttgart',      bbox: [8.0, 48.2, 10.4, 49.6],      tol: 0.0008, dec: 4 },
  { id: 'paris',          bbox: [1.3, 48.1, 3.3, 49.5],       tol: 0.0008, dec: 4 },
  { id: 'continental-us', bbox: [-125.5, 24.0, -66.5, 49.8],  tol: 0.02,   dec: 2 },
];

async function fetchCached(name) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const url = `${NE}/${name}`;
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, text);
  return JSON.parse(text);
}

// Sutherland–Hodgman: clip one ring against an axis-aligned bbox.
function clipRing(ring, [W, S, E, N]) {
  const passes = [
    [(p) => p[0] >= W, (a, b) => [W, a[1] + ((b[1] - a[1]) * (W - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= E, (a, b) => [E, a[1] + ((b[1] - a[1]) * (E - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= S, (a, b) => [a[0] + ((b[0] - a[0]) * (S - a[1])) / (b[1] - a[1]), S]],
    [(p) => p[1] <= N, (a, b) => [a[0] + ((b[0] - a[0]) * (N - a[1])) / (b[1] - a[1]), N]],
  ];
  let out = ring;
  for (const [inside, cross] of passes) {
    const inp = out;
    out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ai = inside(a), bi = inside(b);
      if (ai) out.push(a);
      if (ai !== bi) out.push(cross(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

// Polylines: keep inside runs, split at exits. Crossing segments lose the
// exact boundary point — the render window sits well inside the clip bbox,
// so the truncation is never visible.
function clipLine(line, [W, S, E, N]) {
  const inside = (p) => p[0] >= W && p[0] <= E && p[1] >= S && p[1] <= N;
  const segs = [];
  let cur = [];
  for (const p of line) {
    if (inside(p)) cur.push(p);
    else if (cur.length) { if (cur.length > 1) segs.push(cur); cur = []; }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    const [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-12;
    let maxD = 0, maxI = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = Math.abs((pts[i][0] - x0) * dy - (pts[i][1] - y0) * dx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tol) { keep[maxI] = 1; stack.push([i0, maxI], [maxI, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const roundPts = (pts, dec) => {
  const f = 10 ** dec;
  const out = [];
  for (const [x, y] of pts) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
};

function* rings(geojson) {
  for (const feat of geojson.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') for (const r of g.coordinates) yield r;
    else if (g.type === 'MultiPolygon') for (const poly of g.coordinates) for (const r of poly) yield r;
  }
}
function* lines(geojson) {
  for (const feat of geojson.features) {
    const g = feat.geometry;
    if (!g) continue;
    if (g.type === 'LineString') yield g.coordinates;
    else if (g.type === 'MultiLineString') for (const l of g.coordinates) yield l;
  }
}

const src = {};
for (const [key, name] of Object.entries(SOURCES)) src[key] = await fetchCached(name);

// Every place must fall inside at least one region — coverage is extended
// deliberately, never discovered broken at render time.
const places = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'app', 'public', 'data', 'places.json'), 'utf8'),
);
const uncovered = places.filter(
  (p) => !REGIONS.some(({ bbox: [W, S, E, N] }) => p.lon >= W && p.lon <= E && p.lat >= S && p.lat <= N),
);
if (uncovered.length) {
  console.error('places outside every region bbox:');
  for (const p of uncovered) console.error(`  ${p.id} (${p.lat}, ${p.lon})`);
  process.exit(1);
}

const regions = [];
for (const { id, bbox, tol, dec } of REGIONS) {
  const region = { id, bbox: { west: bbox[0], south: bbox[1], east: bbox[2], north: bbox[3] }, land: [], lakes: [], borders: [] };
  for (const [layer, source, isLine] of [
    ['land', src.land, false],
    ['lakes', src.lakes, false],
    ['borders', src.states, true],
    ['borders', src.countries, true],
  ]) {
    const geoms = isLine ? lines(source) : rings(source);
    for (const geom of geoms) {
      if (isLine) {
        for (const seg of clipLine(geom, bbox)) {
          const s = roundPts(simplify(seg, tol), dec);
          if (s.length > 1) region[layer].push(s);
        }
      } else {
        const clipped = clipRing(geom, bbox);
        if (clipped.length < 3) continue;
        const s = roundPts(simplify(clipped, tol), dec);
        if (s.length > 2) region[layer].push(s);
      }
    }
  }
  const verts = ['land', 'lakes', 'borders'].reduce(
    (n, l) => n + region[l].reduce((m, g) => m + g.length, 0), 0);
  console.log(
    `${id}: land ${region.land.length} rings, lakes ${region.lakes.length}, ` +
    `borders ${region.borders.length} lines, ${verts} vertices`,
  );
  regions.push(region);
}

const json = JSON.stringify({ regions });
const gz = zlib.gzipSync(json, { level: 9 }).length;
console.log(`raw ${(json.length / 1024).toFixed(0)} KB, gzip ${(gz / 1024).toFixed(0)} KB (budget 250 KB)`);
if (gz > BUDGET) {
  console.error('OVER BUDGET — raise tolerances or trim regions; nothing written.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, json);
console.log(`wrote ${OUT}`);
```

- [ ] **Step 2: Gitignore the download cache** — append to the repo's `.gitignore` (create the line, keep existing content):

```
scripts/.ne-cache/
```

- [ ] **Step 3: Run it** — `node scripts/build-basemap.mjs`. Expected: per-region layer/vertex counts, size line under budget, `wrote … basemap.json`, exit 0. If gzip is over 250 KB: raise `tol`/lower `dec` for `continental-us` first (it dominates), re-run. If a Natural Earth URL 404s, check the filename against https://github.com/nvkelso/natural-earth-vector/tree/master/geojson — do not substitute a different dataset silently.

- [ ] **Step 4: Sanity-check the asset shape against places-geo** — `<scratchpad>/verify-basemap.ts`:

```ts
/* Asset ↔ module contract check + eyeball SVG. Run: node verify-basemap.ts */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  fitBbox, ringPath, linePath, chooseRegion, project,
} from '/home/john/dev/active/jazz-canon/app/src/lib/places-geo.ts';
import type { Basemap } from '/home/john/dev/active/jazz-canon/app/src/lib/places-geo.ts';

const bm: Basemap = JSON.parse(
  fs.readFileSync('/home/john/dev/active/jazz-canon/app/public/map/basemap.json', 'utf8'),
);
assert.ok(bm.regions.length >= 8, 'all regions present');
for (const r of bm.regions) {
  assert.ok(r.land.length > 0, `${r.id}: land rings exist`);
  assert.ok(r.bbox.west < r.bbox.east && r.bbox.south < r.bbox.north, `${r.id}: sane bbox`);
}
// an NYC pin picks the nyc region, not continental-us
assert.equal(chooseRegion([{ lon: -73.9752, lat: 40.885 }], bm.regions)!.id, 'nyc');

// eyeball render: one SVG per region into the scratchpad
for (const r of bm.regions) {
  const vp = { width: 640, height: 400 };
  const t = fitBbox(r.bbox, vp, 8);
  const land = r.land.map((g) => `<path d="${ringPath(g, t)}" fill="#f3eee2" stroke="#9db4c0" stroke-width="0.7"/>`).join('');
  const lakes = r.lakes.map((g) => `<path d="${ringPath(g, t)}" fill="#dce8ee"/>`).join('');
  const borders = r.borders.map((l) => `<path d="${linePath(l, t)}" fill="none" stroke="#c9c0b0" stroke-width="0.6"/>`).join('');
  fs.writeFileSync(
    `${process.env.SCRATCH ?? '.'}/basemap-${r.id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#dce8ee"/>${land}${lakes}${borders}</svg>`,
  );
}
console.log('verify-basemap: ALL PASS, eyeball SVGs written');
```

Run with `SCRATCH=<scratchpad> node <scratchpad>/verify-basemap.ts`, then Read the NYC and continental-US SVGs to confirm recognizable geography (Manhattan/Hudson for NYC — this is the spec's main risk; if the Hudson is unrecognizable, the documented fallback is lowering `tol` for `nyc` and, if still poor, adding `ne_10m_rivers_lake_centerlines.geojson` as a polyline layer to the script's SOURCES/loop, budget permitting).

- [ ] **Step 5: Add `loadBasemap` to `app/src/lib/data.ts`:**

```ts
// with the imports:
import type { Basemap } from './places-geo';
// with the promise slots:
let basemapPromise: Promise<Basemap> | null = null;
// below loadPlaces():
export function loadBasemap(): Promise<Basemap> {
  return (basemapPromise ??= fetchJson<Basemap>('/map/basemap.json'));
}
```

- [ ] **Step 6: Static gate** — `cd app && npm run check` → clean.

- [ ] **Step 7: Commit** (script + asset + gitignore + loader):

```bash
git add scripts/build-basemap.mjs app/public/map/basemap.json .gitignore app/src/lib/data.ts
git commit -m "Committed basemap asset + Natural Earth authoring script (budget-enforced)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: FloatingWindow extraction (behavior-preserving)

**Files:**
- Create: `app/src/lib/FloatingWindow.svelte`
- Modify: `app/src/App.svelte` (remove inline window state/markup/styles), `app/src/app.css` (receive shared chrome rules)

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: `FloatingWindow` with props `{ variant: 'constellation' | 'place'; title: string; guide?: string; ariaLabel: string; showBack?: boolean; onBack: () => void; onClose: () => void; children: Snippet }`. Task 5 renders `PlaceWindow` inside it with `variant="place"`.

This is the risky refactor the spec calls out (§5, gate 6): the Constellation must be pixel- and behavior-identical after it.

- [ ] **Step 1: Capture the "before" evidence.** Install playwright-core in the scratchpad (`cd <scratchpad> && npm install playwright-core`), run the app (`cd app && npm run build && npm run preview -- --port 4173` in background), then run this probe — `<scratchpad>/probe-constellation.mjs` (also the template for Task 5/6 probes; first CLI arg is the screenshot prefix, e.g. `before`/`after`):

```js
// node probe-constellation.mjs before
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const prefix = process.argv[2] ?? 'probe';
const shell = path.join(
  os.homedir(),
  '.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
);
const browser = await chromium.launch({ executablePath: shell, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
await page.goto('http://localhost:4173');
await page.waitForSelector('button.card', { timeout: 15000 });

// open any album card, then follow its first musician into the Constellation
await page.locator('button.card').first().click();
await page.waitForSelector('.dd button.person');
await page.locator('.dd button.person').first().click();
await page.waitForSelector('.win-title');
await page.waitForTimeout(3500); // force-layout settle
const rect = () =>
  page.evaluate(() => {
    const el = document.querySelector('[aria-label="Constellation"]');
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
console.log('initial', await rect());
await page.screenshot({ path: `${prefix}-initial.png` });

// drag the title bar by (200, 120)
const bar = await page.locator('.win-bar').boundingBox();
await page.mouse.move(bar.x + bar.width / 2, bar.y + 10);
await page.mouse.down();
await page.mouse.move(bar.x + bar.width / 2 + 200, bar.y + 10 + 120, { steps: 8 });
await page.mouse.up();
console.log('after-drag', await rect());
await page.screenshot({ path: `${prefix}-dragged.png` });

// resize by (−300, −200) from the grip
const grip = await page.locator('.resize-grip').boundingBox();
await page.mouse.move(grip.x + 10, grip.y + 10);
await page.mouse.down();
await page.mouse.move(grip.x + 10 - 300, grip.y + 10 - 200, { steps: 8 });
await page.mouse.up();
console.log('after-resize', await rect());
await page.screenshot({ path: `${prefix}-resized.png` });

// phone full-screen
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
console.log('phone', await rect());
await page.screenshot({ path: `${prefix}-phone.png` });

await browser.close();
```

The logged rects are the comparison baseline: run it now, before touching any code, and keep the output.

Caveat from the house recipe: cover-art hotlinks are slow (~2 s) and intermittently 500 — grey tiles in screenshots are latency, not bugs. Note the probe targets `[aria-label="Constellation"]`, which is the `<section>`'s aria-label both before and after the refactor.

- [ ] **Step 2: Move the shared chrome CSS to `app.css`.** First confirm uniqueness: `grep -rn "panel-bar\|nav-btn\|panel-body" app/src` must show only `App.svelte` (plus this task's edits). Then cut the `.panel-bar`, `.nav-btn`, `.nav-btn:hover`, and `.panel-body` rule blocks from `App.svelte`'s `<style>` and paste them verbatim into `app.css` under a comment `/* shared panel/window chrome (used by App, FloatingWindow) */`. The album slide-in panel keeps working because the class names are unchanged.

- [ ] **Step 3: Create `app/src/lib/FloatingWindow.svelte`** — the drag/resize state, handlers, markup, and remaining window CSS move here *verbatim* from `App.svelte` (rename CSS class `constellation` → `fw`; keep every number identical):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant,
    title,
    guide = '',
    ariaLabel,
    showBack = false,
    onBack,
    onClose,
    children,
  }: {
    variant: 'constellation' | 'place';
    title: string;
    guide?: string;
    ariaLabel: string;
    showBack?: boolean;
    onBack: () => void;
    onClose: () => void;
    children: Snippet;
  } = $props();

  // Window drag (grab the title bar). Once dragged, the window keeps
  // explicit coordinates; until then CSS centers it.
  let winPos = $state<{ x: number; y: number } | null>(null);
  let winSize = $state<{ w: number; h: number } | null>(null);
  let winEl = $state<HTMLElement | null>(null);
  let winDrag: { dx: number; dy: number } | null = null;

  function winDown(e: PointerEvent) {
    if (!winEl || (e.target as HTMLElement).closest('button')) return;
    const r = winEl.getBoundingClientRect();
    winDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function winMove(e: PointerEvent) {
    if (!winDrag || !winEl) return;
    const w = winEl.offsetWidth;
    winPos = {
      x: Math.min(Math.max(e.clientX - winDrag.dx, 8 - w * 0.6), window.innerWidth - 60),
      y: Math.min(Math.max(e.clientY - winDrag.dy, 0), window.innerHeight - 60),
    };
  }
  function winUp() {
    winDrag = null;
  }

  // Resize (grab the bottom-right grip). Move/up are handled at the window
  // level so a fast drag off the 20px grip keeps working.
  let winResize: { x: number; y: number; w: number; h: number } | null = null;
  function resizeDown(e: PointerEvent) {
    if (!winEl) return;
    e.stopPropagation();
    e.preventDefault();
    const r = winEl.getBoundingClientRect();
    winResize = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
  }
  function onWindowPointerMove(e: PointerEvent) {
    if (!winResize) return;
    winSize = {
      w: Math.max(560, Math.min(window.innerWidth - 20, winResize.w + (e.clientX - winResize.x))),
      h: Math.max(420, Math.min(window.innerHeight - 20, winResize.h + (e.clientY - winResize.y))),
    };
  }
  function onWindowPointerUp() {
    winResize = null;
  }
</script>

<svelte:window onpointermove={onWindowPointerMove} onpointerup={onWindowPointerUp} />

<section
  class="fw {variant}"
  class:free={winPos !== null}
  style:left={winPos ? `${winPos.x}px` : undefined}
  style:top={winPos ? `${winPos.y}px` : undefined}
  style:width={winSize ? `${winSize.w}px` : undefined}
  style:height={winSize ? `${winSize.h}px` : undefined}
  bind:this={winEl}
  aria-label={ariaLabel}
>
  <div
    class="panel-bar win-bar"
    role="toolbar"
    tabindex="-1"
    aria-label="{ariaLabel} window bar (drag to move)"
    onpointerdown={winDown}
    onpointermove={winMove}
    onpointerup={winUp}
    onpointercancel={winUp}
  >
    <span class="win-name">
      <span class="win-title display">{title}</span>
      {#if guide}<span class="win-guide">{@html guide}</span>{/if}
    </span>
    <span class="win-actions">
      {#if showBack}
        <button class="nav-btn" onclick={onBack} aria-label="Back">← Back</button>
      {/if}
      <button class="nav-btn" onclick={onClose} aria-label="Close {ariaLabel}">✕ Close</button>
    </span>
  </div>
  <div class="panel-body">
    {@render children()}
  </div>
  <div
    class="resize-grip"
    role="button"
    tabindex="-1"
    aria-label="Resize window"
    title="Drag to resize"
    onpointerdown={resizeDown}
  ></div>
</section>

<style>
  /* A large draggable, resizable window over the timeline. Defaults are
     the Constellation's original numbers — behavior-preserving. */
  .fw {
    position: absolute;
    left: 50%;
    top: calc(var(--masthead-h) + 1.5vh);
    transform: translateX(-50%);
    width: min(1640px, 97vw);
    /* fit within the space below the masthead so the resize grip and
       bottom edge always stay on-screen */
    height: min(1160px, calc(100vh - var(--masthead-h) - 4vh));
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 18px 50px rgba(28, 26, 23, 0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
    animation: slide-in 200ms ease-out;
  }
  .fw.free { transform: none; }

  /* Place window: same chrome, list-sized frame */
  .fw.place {
    width: min(760px, 96vw);
    height: min(900px, calc(100vh - var(--masthead-h) - 4vh));
  }

  .win-bar {
    cursor: grab;
    user-select: none;
    touch-action: none;
    align-items: flex-start;
    padding: 14px 40px;
  }
  .win-bar:active { cursor: grabbing; }
  .win-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .win-title {
    font-size: 26px;
    line-height: 1.05;
    color: var(--ink);
    letter-spacing: 0.02em;
  }
  .win-guide { font-size: 12.5px; color: var(--muted); }
  .win-actions { display: flex; gap: 8px; flex: 0 0 auto; padding-top: 2px; }

  .resize-grip {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    touch-action: none;
    background:
      linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 62%,
        transparent 62%, transparent 74%, var(--bn-blue-light) 74%, var(--bn-blue-light) 86%, transparent 86%);
    border-bottom-right-radius: 10px;
  }

  @keyframes slide-in {
    from { transform: translateX(40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @media (max-width: 1024px) {
    .fw { width: 96vw; height: min(1100px, calc(100dvh - var(--masthead-h) - 3vh)); }
    .fw.place { width: min(760px, 96vw); height: min(900px, calc(100dvh - var(--masthead-h) - 3vh)); }
  }

  /* Phone: full-screen (dragging/resizing a floating window isn't useful) */
  @media (max-width: 620px) {
    .fw,
    .fw.place {
      left: 0; right: 0; top: var(--masthead-h);
      transform: none;
      width: 100vw;
      height: calc(100dvh - var(--masthead-h));
      border: none; border-radius: 0;
    }
    .win-bar { padding: 10px 16px; }
    .win-guide { display: none; }
    .resize-grip { display: none; }
  }
</style>
```

Note the one deliberate markup change: the guide line renders with `{@html guide}` so callers can keep the `&ensp;` entities; the aria-labels become `"Constellation window bar (drag to move)"` / `"Close Constellation"` via the `ariaLabel` prop — same strings as today for the Constellation. The grip's label generalizes from "Resize Constellation" to "Resize window" (visual behavior identical).

- [ ] **Step 4: Rewire `App.svelte`.** Delete from `App.svelte`: the winPos/winSize/winEl/winDrag/winResize state and all six handlers, the `onpointermove`/`onpointerup` attributes on `<svelte:window>` (keep `onkeydown`), the whole `.constellation`/`.win-bar`/`.win-name`/`.win-title`/`.win-guide`/`.win-actions`/`.resize-grip`/`@keyframes slide-in` style blocks *except* keep `@keyframes slide-in` if the `.panel` animation still references it (it does — keep it), and the media-query lines that touched `.constellation`. Replace the `person` branch with:

```svelte
{:else if top?.kind === 'person'}
  <FloatingWindow
    variant="constellation"
    title={constName}
    guide="Click an album to open&ensp;·&ensp;click a musician to follow the thread&ensp;·&ensp;drag to rearrange&ensp;·&ensp;scroll to zoom"
    ariaLabel="Constellation"
    showBack={nav.stack.length > 1}
    onBack={() => nav.back()}
    onClose={() => nav.close()}
  >
    <Network
      personId={top.id}
      onOpenAlbum={(aid) => nav.openAlbum(aid)}
      onRecenter={(pid) => nav.openPerson(pid)}
      onmeta={(m) => (constName = m.name)}
    />
  </FloatingWindow>
{/if}
```

with `import FloatingWindow from './lib/FloatingWindow.svelte';` added to the script block. `constName` stays in App.svelte.

- [ ] **Step 5: Static gate** — `cd app && npm run check` → clean (no unused-CSS warnings left behind in App.svelte).

- [ ] **Step 6: Capture the "after" evidence and compare** — rebuild (`npm run build && npm run preview -- --port 4173`), re-run the Step 1 probe as `after-*.png` with the same actions, and compare: initial rect, post-drag rect delta ≈ (200, 120), post-resize rect delta ≈ (−300, −200) clamped at minimums, phone full-screen rect = viewport minus masthead. Read the before/after screenshots side by side — they must be visually identical (allow cover-art latency differences). Any drift in geometry numbers is a failure: fix before committing.

- [ ] **Step 7: Commit:**

```bash
git add app/src/lib/FloatingWindow.svelte app/src/App.svelte app/src/app.css
git commit -m "Extract Constellation window chrome into shared FloatingWindow (behavior-preserving)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Place navigation + Place window

**Files:**
- Modify: `app/src/lib/types.ts` (NavEntry), `app/src/lib/nav.svelte.ts`, `app/src/App.svelte`
- Create: `app/src/lib/PlaceWindow.svelte`

**Interfaces:**
- Consumes: `loadPlaces`, `loadAlbums` (data.ts); `sessionSortKey`, `DEV`, `AlbumPlace` types (places-data.ts); `FloatingWindow` (Task 4).
- Produces: `nav.openPlace(id: string)`; `NavEntry` includes `{ kind: 'place'; id: string }`; `PlaceWindow` props `{ placeId: string; onOpenAlbum: (albumId: string) => void; onmeta?: (m: { name: string }) => void }`; dev-only `window.__nav` seam. Task 6's pins/caption call `nav.openPlace` via a DeepDive prop.

- [ ] **Step 1: Extend `NavEntry` in `types.ts`:**

```ts
export type NavEntry =
  | { kind: 'album'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'place'; id: string };
```

- [ ] **Step 2: Extend `nav.svelte.ts`** — add inside the class (same dedupe-at-top rule as the others):

```ts
openPlace(id: string) {
  const t = this.top;
  if (t && t.kind === 'place' && t.id === id) return;
  this.stack.push({ kind: 'place', id });
}
```

and at the bottom of the file, after `export const nav = new Nav();`:

```ts
/* Dev-only test seam: the repo has no test suite, and behavioral probes
   (playwright against `npm run dev`) need a way to drive navigation
   without scripting the full click path. Absent from production builds. */
import { DEV } from './places-data';
if (DEV) (window as unknown as { __nav?: Nav }).__nav = nav;
```

(Escape/back/close need no changes — `back()`/`close()`/the existing `onKeydown` already operate on any entry kind.)

- [ ] **Step 3: Create `app/src/lib/PlaceWindow.svelte`:**

```svelte
<script lang="ts">
  import { loadAlbums, loadPlaces } from './data';
  import { sessionSortKey, DEV } from './places-data';
  import type { AlbumCard, Place, PlaceAlbumRef } from './types';

  let {
    placeId,
    onOpenAlbum,
    onmeta,
  }: {
    placeId: string;
    onOpenAlbum: (albumId: string) => void;
    onmeta?: (m: { name: string }) => void;
  } = $props();

  interface Row {
    album: AlbumCard;
    ref: PlaceAlbumRef;
    key: string;
  }

  let place = $state<Place | null>(null);
  let rows = $state<Row[] | null>(null);
  let error = $state<string | null>(null);

  const kindLabel: Record<string, string> = {
    studio: 'Studio',
    club: 'Club',
    home: 'Home studio',
    hall: 'Concert hall',
    festival: 'Festival',
    other: 'Venue',
  };

  $effect(() => {
    const id = placeId;
    place = null;
    rows = null;
    error = null;
    Promise.all([loadPlaces(), loadAlbums()])
      .then(([pd, albums]) => {
        if (id !== placeId) return;
        const p = pd.byId.get(id);
        if (!p) {
          error = `Unknown place “${id}”.`;
          return;
        }
        place = p;
        onmeta?.({ name: p.name });
        const byId = new Map(albums.map((a) => [a.id, a]));
        const out: Row[] = [];
        for (const ref of p.albums) {
          const album = byId.get(ref.albumId);
          if (!album) {
            /* contract says impossible; never crash the window */
            if (DEV)
              console.warn(
                `places.json: album "${ref.albumId}" at place "${id}" missing from albums.json — skipped`,
              );
            continue;
          }
          out.push({ album, ref, key: sessionSortKey(ref) });
        }
        /* the temporal story of the room: earliest session here first */
        out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        rows = out;
      })
      .catch((e) => (error = String(e)));
  });
</script>

<div class="pw">
  {#if error}
    <p class="error">Couldn’t load this place ({error}).</p>
  {:else if !place || !rows}
    <p class="loading">Loading…</p>
  {:else}
    <div class="meta">
      <span class="city">{place.city}</span>
      <span class="chip display">{kindLabel[place.kind] ?? 'Venue'}</span>
      {#if place.precision === 'city'}
        <span class="precision">located to city level</span>
      {/if}
    </div>
    <ol class="rows">
      {#each rows as row (row.album.id)}
        <li>
          <button class="row" onclick={() => onOpenAlbum(row.album.id)}>
            <img class="thumb" src={row.album.artUrl} alt="" loading="lazy" />
            <span class="row-meta">
              <span class="row-title">{row.album.title}</span>
              <span class="row-artist">{row.album.artist} · {row.ref.year}</span>
            </span>
            <span class="row-dates">
              {row.ref.dates.length ? row.ref.dates.join(', ') : row.ref.year}
            </span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .pw { padding: 10px 22px 30px; }

  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 8px 0 12px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .city { color: var(--muted); }
  .chip {
    font-variant: small-caps;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: var(--bn-blue);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 10px;
    background: var(--bg);
  }
  .precision { font-size: 12.5px; color: var(--muted); font-style: italic; }

  /* One long, scrollable list — Van Gelder Englewood Cliffs is 59 albums;
     the story reads top to bottom, no pagination. Scrolling comes from
     FloatingWindow's .panel-body. */
  .rows { list-style: none; margin: 0; padding: 0; }
  .rows li { border-bottom: 1px solid var(--line); }
  .rows li:last-child { border-bottom: none; }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 2px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: var(--bg); }
  .thumb {
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 3px;
    background: var(--line);
  }
  .row-meta { min-width: 0; display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .row-title { font-weight: 600; font-size: 14px; color: var(--ink); }
  .row-artist { font-size: 12.5px; color: var(--muted); }
  .row-dates { flex: 0 0 auto; font-size: 12.5px; color: var(--muted); text-align: right; }

  .loading, .error { color: var(--muted); padding: 12px 0; }

  @media (max-width: 620px) {
    .pw { padding: 8px 14px 30px; }
    .row-dates { display: none; }
  }
</style>
```

One phone-width call: session dates hide below 620px to keep rows to one line (title/artist/thumbnail stay). Flag it for John at the visual gate — easily reverted to wrapping if he wants dates on phones.

- [ ] **Step 4: Render it from `App.svelte`** — add imports (`PlaceWindow`), a `let placeName = $state('');`, and a new `{:else if}` branch inserted between the `person` branch's `</FloatingWindow>` and the block's closing `{/if}`:

```svelte
{:else if top?.kind === 'place'}
  <FloatingWindow
    variant="place"
    title={placeName}
    guide="Every canon album recorded here, oldest first&ensp;·&ensp;click one to open"
    ariaLabel="Place"
    showBack={nav.stack.length > 1}
    onBack={() => nav.back()}
    onClose={() => nav.close()}
  >
    <PlaceWindow
      placeId={top.id}
      onOpenAlbum={(aid) => nav.openAlbum(aid)}
      onmeta={(m) => (placeName = m.name)}
    />
  </FloatingWindow>
{/if}
```

- [ ] **Step 5: Static gate** — `cd app && npm run check` → clean.

- [ ] **Step 6: Behavioral probe (real app, real data)** — run `cd app && npm run dev -- --port 5173` in background; playwright probe from the scratchpad against `http://localhost:5173`:
  1. `page.evaluate(() => (window as any).__nav.openPlace('van-gelder-studio-englewood-cliffs'))` → `.fw.place` appears, `.win-title` reads "Van Gelder Studio (Englewood Cliffs)" (assert non-empty and contains "Van Gelder").
  2. Row count: `.pw .rows li` count equals `jq '[.[] | select(.id=="van-gelder-studio-englewood-cliffs") | .albums | length] | first' app/public/data/places.json` (59 today — compute, don't assume).
  3. Order: first row's date key ≤ second's; scrape `.row-dates` of rows 1, 2, and last; confirm ascending years.
  4. Click row 1 → album panel opens (`.dd .title` non-empty); Escape → back to the Place window; Escape → gone.
  5. `__nav.openPlace('cbs-studios-new-york')` (city-grade) → meta line contains "located to city level".
  6. Screenshot the Van Gelder window at 1440×900 and 390×844 for John's review pile.

- [ ] **Step 7: Commit:**

```bash
git add app/src/lib/types.ts app/src/lib/nav.svelte.ts app/src/lib/PlaceWindow.svelte app/src/App.svelte
git commit -m "Place window: nav kind, Constellation-chrome window, date-sorted album list

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Mini-map in the album card

**Files:**
- Create: `app/src/lib/MiniMap.svelte`
- Modify: `app/src/lib/DeepDive.svelte`, `app/src/App.svelte`

**Interfaces:**
- Consumes: `AlbumPlace` (places-data.ts); `Basemap`, `fitBbox`, `project`, `pinsBbox`, `expandBbox`, `ensureMinExtent`, `metroExtent`, `chooseRegion`, `ringPath`, `linePath`, `spreadPins` (places-geo.ts); `loadPlaces`, `loadBasemap` (data.ts); `DEV` (places-data.ts).
- Produces: `MiniMap` props `{ entries: AlbumPlace[]; basemap: Basemap; onOpenPlace: (placeId: string) => void }`; `DeepDive` gains prop `onOpenPlace: (placeId: string) => void`.

- [ ] **Step 1: Create `app/src/lib/MiniMap.svelte`:**

```svelte
<script lang="ts">
  import type { AlbumPlace } from './places-data';
  import { DEV } from './places-data';
  import type { Basemap, BasemapRegion } from './places-geo';
  import {
    fitBbox, project, pinsBbox, expandBbox, ensureMinExtent, metroExtent,
    chooseRegion, ringPath, linePath, spreadPins,
  } from './places-geo';

  let {
    entries,
    basemap,
    onOpenPlace,
  }: {
    entries: AlbumPlace[];
    basemap: Basemap;
    onOpenPlace: (placeId: string) => void;
  } = $props();

  /* Fixed internal coordinate space, ~16:10; the SVG scales with the card. */
  const VP = { width: 640, height: 400 };
  const ASPECT = VP.width / VP.height;

  const pins = $derived(entries.map((e) => ({ lon: e.place.lon, lat: e.place.lat })));

  /* Extent: multi-pin → padded bbox with a 60 km floor; single pin → fixed
     metro window, doubled when the location is only city-grade (a soft
     location never gets a tight frame). */
  const extent = $derived(
    pins.length > 1
      ? ensureMinExtent(expandBbox(pinsBbox(pins), 0.25), 60, ASPECT)
      : metroExtent(pins[0], entries[0].place.precision === 'city' ? 120 : 60, ASPECT),
  );

  const region = $derived<BasemapRegion | null>(chooseRegion(pins, basemap.regions));
  const t = $derived(fitBbox(extent, VP, 24));

  $effect(() => {
    if (region === null && DEV) {
      for (const e of entries)
        console.warn(
          `basemap: no region covers "${e.place.id}" (${e.place.lat}, ${e.place.lon}) — pin on paper; extend scripts/build-basemap.mjs deliberately`,
        );
    }
  });

  interface PinView {
    place: AlbumPlace['place'];
    x: number;
    y: number;
    labelBelow: boolean;
  }
  const pinViews = $derived.by<PinView[]>(() => {
    const raw = entries.map((e) => project({ lon: e.place.lon, lat: e.place.lat }, t));
    const spread = spreadPins(raw, 14);
    /* Label collision: labels default to the pin's right; when two pins sit
       close in y and near in x, the later one's label drops below its pin.
       Offset labels — never drop a pin. */
    const views = entries.map((e, i) => ({
      place: e.place,
      x: spread[i].x,
      y: spread[i].y,
      labelBelow: false,
    }));
    const byY = [...views].sort((a, b) => a.y - b.y);
    for (let i = 1; i < byY.length; i++) {
      const a = byY[i - 1], b = byY[i];
      if (Math.abs(a.y - b.y) < 14 && Math.abs(a.x - b.x) < 110) b.labelBelow = true;
    }
    return views;
  });

  const venueKinds = new Set(['club', 'hall', 'festival']);
  function keyActivate(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenPlace(id);
    }
  }
</script>

<figure class="minimap">
  <svg viewBox="0 0 {VP.width} {VP.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of recording places">
    <!-- water ground; land paints paper over it -->
    <rect width={VP.width} height={VP.height} class="water" />
    {#if region}
      <g>
        {#each region.land as ring}<path d={ringPath(ring, t)} class="land" />{/each}
        {#each region.lakes as ring}<path d={ringPath(ring, t)} class="lake" />{/each}
        {#each region.borders as line}<path d={linePath(line, t)} class="border" />{/each}
      </g>
    {:else}
      <!-- coverage honesty: no basemap region — pins on the paper background -->
      <rect width={VP.width} height={VP.height} class="paper" />
    {/if}
    {#each pinViews as pv (pv.place.id)}
      <!-- Pins are click targets with matching aria-labels; the caption
           below is the keyboard/screen-reader path. -->
      <g
        class="pin"
        role="button"
        tabindex="-1"
        aria-label={pv.place.name}
        onclick={() => onOpenPlace(pv.place.id)}
        onkeydown={(e) => keyActivate(e, pv.place.id)}
      >
        {#if pv.place.precision === 'city'}
          <!-- soft halo: located to city level -->
          <circle cx={pv.x} cy={pv.y} r="14" class="halo" />
          <circle cx={pv.x} cy={pv.y} r="4" class="halo-core {venueKinds.has(pv.place.kind) ? 'venue' : 'studio'}" />
        {:else if venueKinds.has(pv.place.kind)}
          <!-- venue glyph: diamond -->
          <path
            d="M {pv.x} {pv.y - 6.5} L {pv.x + 6.5} {pv.y} L {pv.x} {pv.y + 6.5} L {pv.x - 6.5} {pv.y} Z"
            class="dot venue"
          />
        {:else if pv.place.kind === 'other'}
          <circle cx={pv.x} cy={pv.y} r="4.5" class="dot other" />
        {:else}
          <!-- studio/home: exact dot -->
          <circle cx={pv.x} cy={pv.y} r="5.5" class="dot studio" />
        {/if}
        <text
          class="label display"
          x={pv.labelBelow ? pv.x : pv.x + 10}
          y={pv.labelBelow ? pv.y + 20 : pv.y + 4}
          text-anchor={pv.labelBelow ? 'middle' : 'start'}
        >{pv.place.name}</text>
      </g>
    {/each}
  </svg>
  <figcaption>
    {#each entries as e, i (e.place.id)}
      {#if i > 0}<span class="sep">·</span>{/if}
      <button class="place-link" onclick={() => onOpenPlace(e.place.id)}>{e.place.name}</button>
    {/each}
  </figcaption>
</figure>

<style>
  .minimap { margin: 6px 0 2px; }
  svg {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }

  /* site palette only: water in the blue family, land as paper, muted
     coastlines and borders. Light scheme; first-render values — refined
     at the visual gate with John. */
  .water { fill: rgba(43, 95, 122, 0.12); }
  .paper { fill: var(--bg); }
  .land { fill: #f3eee2; stroke: rgba(43, 95, 122, 0.35); stroke-width: 0.8; }
  .lake { fill: rgba(43, 95, 122, 0.12); stroke: rgba(43, 95, 122, 0.25); stroke-width: 0.6; }
  .border { fill: none; stroke: #d4cbba; stroke-width: 0.8; }

  .pin { cursor: pointer; }
  .dot.studio { fill: var(--bn-blue); stroke: var(--surface); stroke-width: 1.5; }
  .dot.venue { fill: var(--impulse-amber); stroke: var(--surface); stroke-width: 1.5; }
  .dot.other { fill: var(--era-ink); stroke: var(--surface); stroke-width: 1.5; }
  .halo { fill: rgba(43, 95, 122, 0.18); }
  .halo-core.studio { fill: rgba(43, 95, 122, 0.65); }
  .halo-core.venue { fill: rgba(196, 134, 42, 0.75); }

  .label {
    font-variant: small-caps;
    font-size: 13px;
    letter-spacing: 0.04em;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--surface);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  figcaption { margin-top: 5px; font-size: 12.5px; color: var(--muted); line-height: 1.6; }
  .place-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--bn-blue);
  }
  .place-link:hover { text-decoration: underline; color: var(--bn-blue-light); }
  .sep { margin: 0 5px; opacity: 0.6; }
</style>
```

- [ ] **Step 2: Integrate into `DeepDive.svelte`.** Add the prop, the load state, and swap the Studio row. Script additions:

```ts
// imports
import MiniMap from './MiniMap.svelte';
import { loadDetails, loadPlaces, loadBasemap } from './data';
import type { AlbumPlace } from './places-data';
import type { Basemap } from './places-geo';

// props gain onOpenPlace:
let {
  album,
  onOpenPerson,
  onOpenPlace,
}: {
  album: AlbumCard;
  onOpenPerson: (personId: string) => void;
  onOpenPlace: (placeId: string) => void;
} = $props();

// state
let placeEntries = $state<AlbumPlace[] | null>(null);
let basemap = $state<Basemap | null>(null);
let placesError = $state<string | null>(null); // holds the FAILED FILE's name

// inside the existing `$effect` that reacts to album.id (alongside the
// loadDetails call), reset and load; each loader catches separately so the
// error line can name the failed file:
placeEntries = null;
placesError = null;
loadPlaces()
  .then((pd) => {
    if (album.id === id) placeEntries = pd.byAlbum.get(id) ?? [];
  })
  .catch(() => (placesError = 'places.json'));
loadBasemap()
  .then((bm) => (basemap = bm))
  .catch(() => (placesError = 'basemap.json'));
```

Template — replace the current Studio row block

```svelte
{#if detail.studios.length}
  <div class="rec-row"><span class="rec-k">Studio</span>{detail.studios.join(' · ')}</div>
{/if}
```

with:

```svelte
{#if placesError}
  <!-- no silent fallback: keep the legacy text row, name the failed file -->
  {#if detail.studios.length}
    <div class="rec-row"><span class="rec-k">Studio</span>{detail.studios.join(' · ')}</div>
  {/if}
  <p class="map-err">Couldn’t load {placesError} — map unavailable.</p>
{:else if placeEntries !== null && basemap !== null && placeEntries.length > 0}
  <MiniMap entries={placeEntries} {basemap} {onOpenPlace} />
{:else if detail.studios.length}
  <!-- placeless album (absence of a pin must never read as "recorded
       nowhere") — or places still loading; either way the text row -->
  <div class="rec-row"><span class="rec-k">Studio</span>{detail.studios.join(' · ')}</div>
{/if}
```

Style addition in DeepDive: `.map-err { font-size: 12.5px; color: var(--impulse-amber); margin: 2px 0 0; }`.

- [ ] **Step 3: Wire the prop in `App.svelte`** — the `DeepDive` render gains `onOpenPlace={(pid) => nav.openPlace(pid)}`.

- [ ] **Step 4: Static gate** — `cd app && npm run check` → clean (watch for a11y warnings on the SVG `role="button"` groups; the `onkeydown` handler satisfies them).

- [ ] **Step 5: Behavioral probe** — dev server + playwright, real data:
  1. Open album `miles-davis-seven-steps-to-heaven-1963` (via `__nav.openAlbum(...)`): mini-map present, exactly 2 `.pin` groups, aria-labels naming CBS 30th Street and Columbia Hollywood; both `.place-link` captions present. Click pin 0 → Place window for that place opens.
  2. Open `lee-konitz-subconscious-lee-1950` (placeless): NO `.minimap`, NO `.map-err`, the `Studio` text row present exactly as before.
  3. Open an album at `cbs-studios-new-york` (find one via jq) → `.halo` present (soft halo), and compare the extent: evaluate the rendered `viewBox`-relative pin — simply assert `.halo` exists and screenshot for the frame-width eyeball.
  4. Open an album with both `sound-makers-studios` and `nola-penthouse-sound-studios` if one exists (jq: an albumId appearing under both); otherwise any Van Gelder album for the single-pin composition. Screenshot.
  5. Error path: probe with playwright request interception aborting `**/map/basemap.json` → text row + `Couldn’t load basemap.json — map unavailable.`; repeat aborting `**/data/places.json` → same with `places.json` named.
  6. Screenshots of each at 1440; spot-check 390 (map scales with the full-width panel, no horizontal scroll).

- [ ] **Step 6: Commit:**

```bash
git add app/src/lib/MiniMap.svelte app/src/lib/DeepDive.svelte app/src/App.svelte
git commit -m "Mini-map in the album card: pins, epistemic halos, caption, error honesty

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification pass (the spec's seven gates)

**Files:** none created in the repo — probes and screenshots live in the scratchpad. Fixes discovered here are amended into the touched files with a final commit.

Run the production build (`cd app && npm run build && npm run preview -- --port 4173`) and execute every spec §8 gate at three widths — phone 390×844, iPad 820×1180, desktop 1440×900. The `__nav` seam doesn't exist in prod builds; drive gates through the real UI (search box → album, pins, caption links, rows). Where a gate needs a specific album, find it with jq at run time — never hardcode from this plan into the probe without re-deriving.

- [ ] **Gate 1 — Seven Steps to Heaven:** open via search → two pins (NYC + Hollywood), continental fit (both visible in one frame), each pin and each caption link opens the correct Place window (title match).
- [ ] **Gate 2 — Van Gelder Englewood Cliffs:** open Blue Train → pin → window lists every EC album (count from jq, 59 today), sorted ascending by session date, thumbnails render (allow cover-art latency), clicking a row opens that album's card.
- [ ] **Gate 3 — Subconscious-Lee (placeless):** text row only; no map affordance; no error line.
- [ ] **Gate 4 — city-precision place:** an album at a city-grade place → soft halo pin, wider frame than an address-grade neighbor (compare two screenshots), and "located to city level" in its Place window.
- [ ] **Gate 5 — Sound Makers / Nola:** the same-block pair renders two distinguishable pins with offset labels (via an album at either place; if no single album shows both, open each place's window from different albums and verify the *mini-map of an album at Sound Makers* still labels legibly — the spread applies whenever both appear on one map).
- [ ] **Gate 6 — Constellation unchanged:** re-run the Task 4 before/after comparison on the final build: drag, resize, phone full-screen all identical to the Task 4 "before" captures.
- [ ] **Gate 7 — navigation chain:** album → place → album → back → back returns to the starting album; Escape pops one level at a time; Close clears everything.
- [ ] **Static gate:** `npm run check` clean; `npm run build` clean.
- [ ] **Console hygiene:** during all gates, zero console errors and zero dev-warnings (prod build should emit none of the DEV-guarded warnings).
- [ ] **Collect the review pile:** screenshots per gate per width into the scratchpad, named `gate<N>-<width>.png`. Present them to John for the visual-approval gate (his standing rule: real data, three viewports, before visual approval). Pin glyphs, halo strength, land/water tints, and the basemap's Hudson fidelity are explicitly his calls at this review — the plan's values are first passes.
- [ ] **Fix loop:** any gate failure → fix, re-run that gate plus gate 6, amend or add a commit `Places in the Card: visual-gate fixes`.
- [ ] **Final commit** (if fixes were made):

```bash
git add -A app/src scripts
git commit -m "Places in the Card: visual-gate fixes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Deliberate calls this plan makes (flag to John, don't relitigate mid-build)

1. **Basemap lives at `app/public/map/basemap.json`**, not `/data/` — `/data/` stays platform-export-only; the basemap is site-authored. `loadBasemap()` follows the same cached-promise pattern regardless.
2. **`window.__nav` dev-only seam** (one line in `nav.svelte.ts`): the repo's only navigation test hook; absent from production builds. Exists because the repo has no test suite and behavioral probes need to drive navigation directly.
3. **Shared chrome CSS (`.panel-bar`, `.nav-btn`, `.panel-body`) moves from App.svelte's scoped styles to `app.css`** so FloatingWindow and App share one definition instead of two copies.
4. **Coincident pins get display-only spreading** (never dropped, data untouched) — Sound Makers/Nola and the five same-coordinate city-grade NYC places make some visual separation unavoidable; the spread is deterministic and centroid-preserving.
5. **Place-window dates hide at phone width** to keep rows single-line; reversible at the visual gate.
6. **Natural Earth fetched from the `nvkelso/natural-earth-vector` GitHub mirror at `master`** — the committed asset is the reproducibility anchor, the script is the regeneration path.

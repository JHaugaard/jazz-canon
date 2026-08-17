# Places in the Card — design spec

Date: 2026-08-17 · Branch: `studios` · Status: awaiting John's review
Supersedes: the standalone map-over-time page design (shelved, not dead — see §9).
Inputs: `docs/2026-08-17-places-on-site-brief.md` (McCoy), the ratified `places.json`
contract (2026-08-14), John's pivot blessing (2026-08-17).

## 1. Intent

Surface WHERE each album was recorded, inside the existing discovery loop rather
than on a separate page. Two pieces:

1. A **mini-map** in the album card (DeepDive): one pin per session place,
   fit to the album's pins.
2. A **Place window**: click a pin → a floating window (Constellation chrome)
   listing every canon album recorded at that place, in session-date order.

The loop gains a third thread: album → place → album → musician → …

## 2. Data (settled — no platform changes)

**Source: `app/public/data/places.json` only.** The ratified export: 46 places,
`{id, name, kind, city, lat, lon, precision: "address"|"city",
albums: [{albumId, year, dates[]}]}`.

- `loadPlaces()` joins the cached-promise loaders in `data.ts`
  (same pattern as `loadAlbums`). Fetched once, on first album-card open.
- Two derived indexes, built once: `placeId → Place` and the **inversion**
  `albumId → [{place, dates}]`.
- **The brief's proposed `details.json` export change is not needed.** The
  inversion carries identical information; verified on the brief's own trap
  case (Seven Steps to Heaven → two places with correct per-place dates,
  while the current `details.studios` string row is incomplete for it).
- `details.studios` (names only) remains in the export unchanged; the UI uses
  it only as the fallback row for placeless albums (§4) and on load failure (§7).
- Date semantics (per contract): strings lead with a 4-digit year; ISO
  day-precision when known; non-ISO strings are year-grade. Empty `dates[]`
  → the entry's `year`. Parser keeps a no-year guard (dead code by contract,
  kept deliberately).
- Growth: new places/albums arrive only via deliberate platform exports; the
  UI derives everything from the file, hardcodes nothing (no place ids, no
  counts, no region lists in code).

## 3. Geometry (zero new dependencies)

- **No mapping library.** The only D3 package installed is `d3-force`
  (Constellation); `d3-geo` will NOT be added. A pure module
  `app/src/lib/places-geo.ts` implements Web Mercator forward projection,
  bbox fit-with-padding, and GeoJSON polygon → SVG path conversion
  (straightforward at these extents; no clipping or resampling needed
  against a pre-clipped asset).
- **Basemap asset:** one committed, pre-clipped, simplified GeoJSON —
  land/coast/lakes plus state (US) and country (Europe) borders covering the
  pin regions (NYC metro / LA metro / SF–Monterey / Chicago / Oslo /
  Stuttgart region / Paris; plus a continental-US outline for cross-country
  fit like Seven Steps). Budget: **≤ 250 KB gzipped**, lazy-loaded with
  `places.json`. Prepared once from Natural Earth by a documented script in
  `scripts/` (authoring-time tool, not part of the runtime or build).
- **Extent rules:** multi-pin → bbox + padding. Single pin → fixed metro
  window (~60 km wide; ~120 km when `precision:"city"` — a soft location
  never gets a tight frame). Minimum extent applies to multi-pin too.
- **Coverage honesty:** a pin outside the asset's coverage still renders
  (pin + label on the paper background); dev builds log a console warning
  naming the place so the asset gets extended deliberately.

## 4. Mini-map in the album card

- In `DeepDive.svelte`, when the album has ≥1 place: the `Studio` text row is
  replaced by the mini-map block. When it has none (5 albums today): the
  existing text row renders exactly as now — **absence of a pin must never
  read as "recorded nowhere."**
- Fixed aspect (~16:10), full card width, site palette: paper background,
  muted coastlines/borders, water in the site's blue family. Oswald
  small-caps for place labels, Lora for the caption. Light scheme only.
- **Pins:** one per place (never assume one per album). `precision:"address"`
  → exact dot; `precision:"city"` → larger soft halo (geographic epistemic
  honesty). Kind differentiates the mark: `studio`/`home` share the studio
  glyph family, `club`/`hall`/`festival` get a venue glyph, `other` the
  neutral dot. Exact glyph design is a build-time visual decision, reviewed
  with real renders.
- Coincident/near pins at mini-map scale (e.g. Sound Makers + Nola, same
  block): offset labels, never drop a pin.
- **Caption** under the map: the place names as clickable text (also the
  keyboard/screen-reader path; pins carry matching aria-labels).
- Interaction: pin or caption click → `nav.openPlace(placeId)`. No pan, no
  zoom, no hover-dependent information.
- No interaction assumptions that break at phone width; the card panel is
  already full-width on phones, the map scales with it.

## 5. Place window

- New `PlaceWindow.svelte`, rendered by `App.svelte` for nav entries of kind
  `place` — same layering, Escape, back/close semantics as album/person.
- **Window shell extraction:** the draggable/resizable window chrome
  currently inline in `App.svelte` for the Constellation (title bar drag,
  resize grip, phone full-screen) is extracted into a shared
  `FloatingWindow.svelte`; Constellation and PlaceWindow both use it.
  Behavior-preserving refactor — no visual or interaction change to the
  Constellation is acceptable.
- Header: place name (display face), city, kind chip, and a precision note
  when `city`-grade ("located to city level").
- Body: every album at this place, **sorted by earliest session date at this
  place** (undated albums sort by `year` and show the year alone). Each row:
  cover thumbnail (existing `artUrl`), title, artist, recording year, this
  place's session dates. Row click → `nav.openAlbum(id)` (stack semantics
  give back-navigation for free).
- The list is the temporal story of the room — Van Gelder Englewood Cliffs
  renders 59 albums in order; the window must stay usable at that length
  (it scrolls; no pagination).

## 6. Navigation

- `nav.svelte.ts`: `openPlace(id)` pushing `{kind:'place', id}`; same
  dedupe-at-top rule as albums/persons. `NavEntry` type extended.
- Album → place → album → place … chains work to arbitrary depth; `back()`
  walks them; `close()` clears; Escape pops (existing behavior, extended by
  the new kind).
- No URL/hash integration (deep links remain a deferred, separate loop).

## 7. Error handling

- `places.json` or the basemap asset failing to load: the album card keeps
  the legacy `Studio` text row and renders a one-line error in the map slot
  naming the failed file. No silent fallback, no invented map.
- An `albumId` in `places.json` that is missing from `albums.json` (contract
  says impossible): skipped in PlaceWindow with a dev-mode console warning
  naming both ids. Never crash the window.
- `merged-*` slugs (contract says they never export): filtered defensively
  at load with a dev warning if one appears.

## 8. Verification (build gates, real data, no test suite exists in this repo)

Static gate: `npm run check` clean. Visual verification per the established
playwright recipe, at three widths (phone ~390, iPad ~820, desktop ~1440):

1. `miles-davis-seven-steps-to-heaven-1963` → TWO pins (NYC + Hollywood),
   continental fit, both open the right Place window.
2. A Van Gelder Englewood Cliffs album (e.g. Blue Train) → window lists 59
   albums, date-sorted, thumbnails render, clicking a row opens that album.
3. `lee-konitz-subconscious-lee-1950` (placeless) → text row only, no map
   affordance, no error.
4. A `city`-precision place (e.g. a bare-city venue) → soft halo pin, wider
   frame, "located to city level" note in its window.
5. Sound Makers / Nola (same block) → two distinguishable pins with offset
   labels.
6. Constellation before/after the FloatingWindow extraction: drag, resize,
   phone full-screen all unchanged.
7. Album → place → album → back → back chain returns to the start.

## 9. Non-goals (v1)

- No standalone map page, no time scrubber (shelved design preserved in
  `.claude/session-context.md`; the Place window is its natural drill-down).
- No clustering, no pan/zoom, no tiles, no external map services, no keys.
- No schema or export changes; no new npm dependencies.
- No epistemic label on the session→place *link* (precision covers location
  honesty; a per-link label would be an additive platform change later).

## 10. Risks & watch items

- **Basemap asset size/quality trade-off** is the main unknown: metro-zoom
  coastline fidelity (the Hudson at Englewood Cliffs) vs the 250 KB budget.
  The prep script makes regeneration cheap; first renders decide.
- **Platform latent break** (recorded in session context): a promoted
  drip-staged album with an incomplete studio row fails the platform's
  export scripts — a platform bug with a planned fix, not a site concern,
  noted here so a broken future ship isn't blamed on this feature.
- The window-shell extraction touches the Constellation — gate 6 exists
  precisely for it.

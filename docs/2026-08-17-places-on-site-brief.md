# Recording Places on the Site — design brief (McCoy, 2026-08-17)

Audience: Claude Code (planning + build in this repo). Author: McCoy (mccoy
profile), from live DB inspection and a read of `app/src`. John will review;
nothing here is decided except where marked **[John's call]**.

## Feature intent

Surface WHERE each album was recorded. John's current direction (supersedes
the earlier standalone map-over-time page idea, which stays on the shelf):

1. A small map with pin(s) inside the existing album card modal
   (`app/src/lib/DeepDive.svelte`).
2. Clicking a pin opens a floating detail window — same chrome/pattern as
   the Constellation window — showing that place's full detail: its albums,
   in date order.

Rough visual references: `/home/john/dev/screenshots/` (two mockups from
2026-08-04: a "Recording Venues" card with a Google Map, navy mic pins, and
a pin-anchored modal listing "Van Gelder Studio, Englewood Cliffs, NJ" with
albums + years). Those mockups are for feel only, not layout gospel.

## Data reality (verified live 2026-08-17, DB on vps8:5433, schema `_jazzcanon`)

- Places table is `_jazzcanon.studio` (historical name; it holds all place
  kinds). Columns: id, name, name_slug, city, kind, address, lat, lon,
  location_epistemic, location_source, notes.
- 47 canonical places, ALL with coordinates. `kind` values: studio (28),
  club (10), other (3), home (3), hall (2), festival (1).
- 272 sessions, 258 placed via `session.studio_id`; 14 unplaced (unk).
  Session dates span 1949-01-21 → 1973-11-28.
- Distribution is extremely NY-metro heavy: New York 98, Englewood Cliffs
  81, Hackensack 22, Hollywood 25, Los Angeles 12; tail = SF, Oslo,
  Chicago, Hermosa Beach, Ludwigsburg, Paris, etc. (~80% NY metro).
- `merged-*` slug rows are merge tombstones — never render them.
- Place aliases live in `studio_name_variant`; "Van Gelder Studio" is
  deliberately NOT an alias (ambiguous between Hackensack and Englewood
  Cliffs). Never join frontend data by name string.

## Existing export

`app/public/data/places.json` already ships from the DB (46 places). Shape:

```json
[{
  "id": "a-r-recording-112-west-48th-street",   // = studio.name_slug
  "name": "A & R Recording (112 West 48th Street)",
  "kind": "studio",
  "city": "New York, NY",
  "lat": 40.75876, "lon": -73.98185,
  "precision": "address",                        // exactly two values in the file: "address" | "city"
  "albums": [{"albumId": "john-coltrane-ole-coltrane-1961", "year": 1961, "dates": ["1961-05-25"]}]
}]
```

This file is NOT yet loaded by `app/src/lib/data.ts` (grep confirms no
reference). It already contains everything the Place detail window needs.

## The one pipeline gap

`details.json` per-album records carry `studios: string[]` (names only —
rendered as the text row at DeepDive.svelte:154-155). No place id, no
coordinates. The mini-map cannot be built from this.

**Required export change (export.sh / details shape):** replace or augment
`studios: string[]` with structured place refs per session:

```json
"places": [{
  "placeId": "<studio.name_slug>",
  "name": "...", "city": "...", "kind": "...",
  "lat": 0.0, "lon": 0.0,
  "precision": "address|city",
  "epistemic": "obs|inf",
  "sessionDates": ["1972-09-09"]
}]
```

Notes:
- One entry PER SESSION, not per album — multi-session multi-place albums
  exist (Seven Steps to Heaven is the canonical trap: two sessions, two
  cities; a compound place string was a real 2026-08-13 staging failure).
- Source of truth for the join is `session.studio_id` → `studio`, never the
  album-level text.
- Albums whose sessions are all unplaced (14 sessions total) must emit an
  empty/absent `places` array — the UI then shows no map affordance.
  Absence of a pin must never read as "recorded nowhere"; keep the plain
  text studio row as the fallback for those.

## Frontend shape (proposal)

1. **Mini-map in DeepDive.svelte.** Replace/augment the `Studio` text row
   with a small static-ish map when `detail.places` is non-empty.
   Requirements:
   - Render N pins (one per session place). Do NOT assume a single pin.
   - Pin click → opens the Place window for that place.
   - Pin visual should distinguish `precision: address` from `city`
     (e.g. exact dot vs larger soft radius) — the site's epistemic honesty
     convention extends to geography. `EpistemicBadge.svelte` exists if a
     badge is wanted in the Place window.
   - At this size, keep interaction minimal (no need for full pan/zoom;
     fit-bounds to the album's pins is enough).

2. **Place window (new component, e.g. `PlaceWindow.svelte`).** Reuse the
   Constellation window pattern: `App.svelte` already implements the
   draggable title-bar window + resize grip (see lines ~31-171) for
   `Network.svelte`. Same shell, different payload:
   - Header: place name, city, kind.
   - Body: album list from places.json — title, year, session dates —
     each linking to that album's card/DeepDive. Sorted by date. This
     list IS the temporal view of the place.
   - Epistemic/precision indicator per house convention.
   - Opening from the mini-map: pin click sets a `placeId`; window opens
     centered/draggable like Constellation.

3. **Basemap decision [John's call].** Options:
   - Google Maps (as mockups) — external API key + dependency; the site is
     currently fully self-contained/static on Cloudflare Pages.
   - MapLibre GL + a light open basemap (e.g. Carto Positron) — external
     tiles but no key.
   - No-tile dot map on a minimal world/US outline — fully self-contained;
     viable because only ~10 cities are in play, but less legible to
     visitors without geography knowledge.
   McCoy's suggestion: prototype no-tile or MapLibre first; keep Google as
   fallback if legibility fails at modal size.

## Explicit non-goals for v1

- No standalone map page, no time scrubber/animation. (The global
  map-over-time page remains a possible v2; the Place window becomes its
  drill-down, so this v1 is not a dead end.)
- No clustering logic — only needed at world-map scale, not for per-album
  pins.
- No new data gathering. All claims come from `studio`/`session` as-is.

## Pitfalls carried in from the workshop

- Never join on place name strings; use `name_slug`/`placeId`.
- Never render `merged-*` slug rows.
- City-level (`inf` precision) places must not render as confident exact
  dots.
- A compound session string means multiple sessions — if `details.json`
  ever shows one place entry summarizing two venues, that's an export bug
  to fix at the source, not in the component.
- ship.sh regenerates `details.json` on every export — any hand-edit to
  exported files is thrown away. Shape changes belong in export.sh and the
  DB, per the one-way rule (DB → export → site).

## Verification ideas for the build session

- `miles-davis-seven-steps-to-heaven-1963` should render TWO pins.
- Any Van Gelder Englewood Cliffs album: pin opens a Place window listing
  dozens of albums with dates, sorted.
- An album with unk place (find via `session.studio_id IS NULL`): shows
  text row only, no map.
- places.json consumers: confirm the file loads once in data.ts and is
  indexed by id for O(1) lookup from the window.

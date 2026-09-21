# Where — recording places over time (2026-09-21)

## Accepted intent

Add a first-class `#/where` route named **Where**. It is a comparative view of where the canon's represented recording activity happened over time, using the existing Working page's sticky-label/shared-timeline pattern.

John accepted these decisions on 2026-09-21:

- One mark per dated recording event: `(placeId, albumId, recordingDate)`.
- Place rows ordered by their first represented recording date; stable place ID breaks ties.
- Keep all 55 exported places available in the vertically scrollable field.
- Keep Van Gelder Studio, Hackensack and Van Gelder Studio, Englewood Cliffs separate.

## Data contract and epistemics

- Source is the exported `places.json`; never edit it for this view.
- Join albums and places only by `albumId` / place ID, never by names.
- The horizontal axis follows recording dates, not album release years.
- `YYYY-MM-DD` events use day placement; `YYYY-MM` events use month precision. A contract-valid empty dates array falls back to its album year and is centred at year precision.
- The one spanning date, `1954-1955`, is not assigned an invented point. Its place row remains visible and the omission is disclosed.
- City-precision place identities remain visible but use a visibly softer mark treatment and accessible precision language.
- The page describes represented/known locations rather than claiming complete historical coverage.

## Interaction and layout

- Sticky place name and city on the left; one horizontally scrollable shared date field on the right.
- A simple event mark opens the existing album panel.
- A place label opens the existing Place window.
- Events crowded within one calendar month use deterministic vertical micro-lanes with non-overlapping 24px targets; horizontal positions are not moved for visual convenience. This includes the one exact-date collision, whose two albums remain separate focusable dots at the same x coordinate.
- Every mark is a focusable button with an album/place/date accessible name. Hover-only information is never required.

## V1 exclusions

No map-first replacement, time scrubber, zoom, venue filtering, data-export change, or new modal system. The existing album panel and Place window remain the drill-down surfaces.

## Verification

- `npm run check`
- `npm run build`
- Real-data assertions for 55 rows, 361 renderable point events, 1949–1975 date span, chronological row ordering, separate Van Gelder rows, and one omitted spanning date (362 exported date values total).
- Browser exercise at desktop and phone widths, including route navigation, horizontal scrolling, album opening, place opening, and the separate same-day event dots.

# Site expansion, credits, and date-follow scrolling

## Status and authority

John's current scope, 2026-09-25. Work in the existing checkout on `main`.
This document captures implementation scope and a proposed interaction spec;
it does not claim that code, exports, browser acceptance, or deployment are complete.
John accepted the Follow dates framing after reviewing the proposed behavior;
it is in scope, with interaction details still subject to implementation tests
and visual acceptance.
Keep preview enrichment and ship-automation work outside this change.

Future-page preparation: `docs/2026-09-25-the-board-brief.md` stages The Board.
The credits export must retain canonical person IDs and explicit roles for
future producer/engineer/musician album intersections. No Board route or dead
UI stubs belong in this release.

## Timeline and Bebop — accepted scope

- Album timeline covers 1945–1985; John confirms queued albums beyond 1979.
- Open with the 1965 year block centered in the usable viewport, not at the
  pixel midpoint of the entire canvas (year widths vary with album density).
- Initial positioning happens on first successful layout. User panning must
  not be reset by incidental resize or reactive recalculation.
- Bebop era band initially spans 1945–1955. This is an editorial era, never
  an album eligibility filter. Later Bebop albums retain their classification
  and card treatment at their actual exported year.
- Reuse the established tint, overlap, label, and card-accent machinery.
  Candidate code is retained in commit `2386625`, worktree
  `/home/john/dev/cruft/jazz-canon/jazz-canon-bebop-2026-09-25`.
  Its color and seven-band composition still need visual acceptance.
- About describes the expanded 1945–1985 scope and includes Bebop.
- Working and Where must accommodate the expanded dates. Proposed common
  minimum axis span: 1945–1985, extended for actual recording dates outside
  it rather than clipped. These routes have musician/venue lanes, not the
  album timeline's genre bands.
- Verify sparse and dense early-year layouts; labels, overlap colors, and
  existing bands across desktop, short-window, and mobile sizes. Dense years
  should gain columns, not smaller cards or shifted album years.

## Production credits — accepted display and agreed export contract

John requests Producer and Engineer information below the musician roster
inside the expanded **Full album personnel** section. The shared component
is `app/src/lib/DeepDive.svelte:231-251`; implement once for all entry routes.

Display rules:
- Same typography and visual hierarchy as the roster, separated by modest
  top spacing or a subtle rule. No separate large panel.
- Show each populated role and all credited names; preserve distinct people
  with the same name. Absent roles produce no placeholder or empty divider.
- No guessed credits, no inference from record label/studio, and no mixing
  of Producer/Engineer with separately classified mixing/mastering credits.
- Preserve supplied epistemic distinctions using existing conventions.
- Plain credit names initially: do not send production-only people into a
  musician constellation with no supporting performance data.
- Old exports lacking the new field must continue rendering normally.

Observed boundary:
- All 234 current detail records have only description, recordingDates,
  leader, studios, tracks, personnel. No production-credit fields or
  production-like instrument entries were found.
- `app/src/lib/types.ts:45-52` mirrors that export.
- Historical `db/schema.sql:442-449` has production_credit with album_id,
  optional session_id, person_id, role, epistemic, notes. Its role enum
  distinguishes producer, engineer, mixing, mastering, and other roles.
  This historical snapshot does NOT establish current populated coverage.
- Initial consultation timed out; the implementation consultation subsequently
  confirmed the contract below. mccoy's `a212d53` implements it in export.sh.

Agreed data-owner contract:
- AlbumDetail has `productionCredits`, an array of
  `{personId, name, role, e, sessionId}`. Roles are `producer` or `engineer`;
  `e` is `obs`, `inf`, or `unk`; sessionId is a canonical ID or null for an
  album-level credit. An empty array is valid; old exports may omit the field.
- Preserve raw edges for The Board. Display deduplicates person ID + role,
  conservatively retaining the least-certain label across session credits.
  Session-only rows are identified as such. Names remain non-link text until
  role-aware Board navigation exists.
- Coder independently inspected the generated 248-album incoming export:
  240 albums with producers, 187 with engineers, 8 with neither, 427 total
  credit rows. The incoming batch has 14 albums, including five Bebop albums
  dated 1945–1948 and albums through 1983. Full incoming export is previewed
  only via browser interception, not copied into production site data.
- Establish current coverage and original-recording versus reissue semantics;
  deduplicate repeated session credits without losing relevant scope.
- mccoy owns export generation/checksum refresh and data publication. Coder
  does not edit public JSON or refresh checksums to force a pass.
- Verify both roles, one role, multiple names, repeated session credits,
  uncertainty, and missing fields. Real live-credit acceptance remains blocked
  until a verified export carries credits; fixtures only prove UI behavior.

## Working / Where: Follow dates interaction

The original visibility-assist proposal below was superseded by John's
acceptance of leading-mark following. The first plotted event determines a
musician's or place's cohort, even across a decades-long gap to the next mark;
the connecting lane line in Working remains the visual clue to that gap.
Keep the fixed, truthful date axis and move the viewport, not the marks.

### Goal

Ordinary vertical browsing should reveal relevant dates without requiring
constant separate horizontal adjustment. Native scrolling stays native;
this is an assistive horizontal adjustment, not forced diagonal wheel input.

### Why not a fixed diagonal ratio?

Both row sets are ordered by earliest represented date, but row density,
career/venue duration, and Where row heights vary. Scroll percentage is not
calendar position. Long-lived people and venues also contain later events.
Follow actual plotted marks, not index-to-year interpolation or lane end caps.

### Accepted behavior

1. Add an accessible **Follow dates** toggle, initially on. Show a paused
   state and explicit resume control after manual horizontal navigation.
   Keep state while the route remains mounted; no cross-session persistence.
2. Observe vertical movement inside the existing `.lanes-scroll` element,
   not merely the outer page. Scrolling introductory text causes no pan.
3. Select the plottable row nearest one-third down the usable viewport below
   the sticky axis. As vertical scrolling runs out at the bottom, let the
   reading line move toward the final visible row so late cohorts remain
   reachable. If it has no marks, use the nearest visible plottable row;
   if no visible row has marks, leave horizontal position unchanged.
4. Calculate the horizontally usable date area excluding the sticky name
   column. Settle the anchor row's earliest actual plotted mark in a modest
   screen-space resting zone near its left edge, even if a later mark is already
   visible. An early mark remains authoritative across long hiatuses.
5. Follow in both vertical directions. Keep an anchor until the next row crosses
   the selection line; use a resting zone and dead zone to avoid tiny repeated
   adjustments. Retarget one smooth horizontal movement rather than snapping
   or stacking animations. Reduced motion adjusts immediately.
6. Provide a small leading margin and a viewport-responsive trailing runway in
   both date fields so even the earliest and latest possible marks can settle
   away from hard scroll limits; keep ticks, hairlines, hit areas and dots
   aligned. Do not try to fit every mark of a long row.
7. Any deliberate horizontal wheel/trackpad, scrollbar drag, horizontal touch
   gesture, or keyboard panning pauses following until explicit resume. Programmatic
   horizontal scroll events must not count as manual navigation or trigger loops.
8. Keyboard focus and explicit search/jump navigation take precedence. Pause
   while focus is on an interactive mark or a mark popover is open; never move
   its target away during inspection. Coordinate with Working's existing
   scroll-to-person and tooltip-close behavior rather than introducing races.
9. Respect reduced-motion settings: use immediate adjustments rather than
   smooth movement. Manual touch, trackpad, keyboard, and scrollbar behavior
   remains available when following is off.
10. Clamp to actual scroll limits; recalculate viewport geometry after resize,
    filters, and data changes. No date shifts, fabricated points, new dot
    spacing, or row reordering to make scrolling easier.

### Evidence and implementation seams

- Working: `people-data.ts:23-71` sorts by actual first session;
  `Working.svelte` groups marks by month, has sticky names/axis and an inner
  scroll box, search-driven scrollIntoView, and tooltip handling on scroll.
- Where: `where-data.ts:100-140` preserves true event dates and orders rows
  by first represented date. Rows can have variable micro-lane heights and
  unsupported dates. `Where.svelte` has the same inner scroll-box pattern.
- Share target-selection/manual-override logic between routes; provide
  route-specific mark geometry. Preserve current date precision and hit areas.

### Acceptance checks before release

- Vertical-only navigation through early, middle, late, sparse, dense, and
  long-duration real rows keeps relevant anchor-row marks visible.
- No pan when the first mark is already in the resting zone; no movement for empty rows.
- Upward scrolling follows sensibly; bottom/top and horizontal limits clamp.
- Manual horizontal input wins immediately and remains in control until resume.
- Sticky labels/axis remain visible and do not obscure focused marks.
- Search, filters, album/venue/person opening, and return navigation remain
  usable; no oscillation, scroll reset, animation backlog, or focus stealing.
- Exercise desktop mouse wheel, two-axis trackpad, keyboard, touch, narrow
  viewport, short viewport, and reduced motion. Report untested devices honestly.
- Unit-test target calculations and override state; browser-test both real
  routes. Obtain independent review of interaction behavior before release.

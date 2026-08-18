# Who Was Working — people-over-time lanes page, design brief (McCoy, 2026-08-18)

Audience: Claude Code / Fable 5 (planning + build in this repo). Author: McCoy
(mccoy profile), from live DB inspection. John has ruled on the shape decisions
marked **[ruled]**; items marked **[open]** are his to decide during planning.

Companion piece: `2026-08-17-places-on-site-brief.md` (shipped). Same house
rules apply: DB → export → site one-way; never invent precision; epistemic
honesty in the visuals.

## Feature intent **[ruled]**

A new route (own page — NOT part of the fixed-viewport main experience):
a people-over-time view. Each musician is a horizontal lane spanning the
canon's years; session activity appears as marks along the lane. Users see
who was working when, who overlapped, who arrived, who went quiet, who left
for good. Clicking a person opens their Constellation (the existing
Network.svelte pattern).

Context: jazzcanon.com is gaining a real nav bar (this page, plus John's
forthcoming writings/notes page). The route should be built as a first-class
nav destination.

## Data reality (verified live 2026-08-17/18, DB vps8:5433, `_jazzcanon`)

- 492 distinct musicians in the live canon (`canon_status='included'`).
- Live-canon sessions: 266; 257 full-dated (`session.session_date`), 9
  text-only (`session_date_text` only, no date).
- Per-year active-musician counts run 4–70; busiest year-months canon-wide:
  6 sessions (1963-06, 1968-03).
- Same-person-same-month collisions: worst case is 2 albums, occurring 48
  times canon-wide. Lane marks at month precision never stack deeper than 2.
- Session span: 1949-01-21 → 1973-11-28. The scrub/axis END must be
  data-driven (max session date), not hardcoded — the canon is dripping
  toward 1979 and the page should extend itself.
- Gap years exist (e.g. 1951 has no sessions). Render them honestly as
  emptiness — do not interpolate.
- **`performance_session` is EMPTY (0 rows).** Person↔session attribution
  therefore runs at ALBUM level: every performance row on an album is
  attributed to that album's session dates. Exact for single-session albums
  (the large majority); slightly smeared for multi-year/multi-session ones.
  Accepted for this visualization; a `performance_session` backfill is
  workshop-side future work, not a site blocker.

### Validation anchors (sanity checks the finished page should reproduce)

- Paul Chambers: active 1955–1965 (9 years), then final exit.
- Miles Davis: 14 active years, 1949–1970 — the longest arc in the canon.
- Herbie Hancock & McCoy Tyner: 10 years each; Coltrane, Elvin Jones,
  Ron Carter, Wayne Shorter: 9 each.
- Top-12-by-years-active list available from McCoy if needed for fixtures
  testing.

## Lane visual grammar **[ruled]**

Full arcs across the whole span — NOT a scrubbed roster where lanes
enter/collapse. The page knows each musician's complete arc, so it never
throws that knowledge away:

- **Active period:** marks on the lane at session dates.
- **Hiatus (gone for a while, comes back):** lane line continues faintly
  through the gap; marks resume. The gap is information (Rollins' bridge
  years are the canonical example).
- **Final exit (gone from the canon for good):** lane terminates with an
  end-cap at the last canon session. Chambers 1965, Brown 1956, Coltrane
  1965 (canon appearances, not biographical claims).
- **Required copy (one line, epistemic house rule):** "final exit" means
  last appearance *in this canon*, not death or retirement — e.g. Chambers
  recorded into 1968 but those records aren't (yet) in the canon.

## Time axis **[ruled]**

- Labels: YEARS (1949 → data-driven end). 31 ticks is readable; 372 month
  ticks is wallpaper.
- Mark PLACEMENT: true session date (month-exact; day precision is below
  pixel resolution but can order same-month marks).
- Same-person same-month ×2: jitter slightly or a ×2 glyph — implementer's
  choice, both survive the data (max depth 2).
- The 9 text-only-date sessions: EXCLUDED from lanes with a small "N
  sessions undated" footnote. Never guess them into a month.

## Vertical axis / roster management **[ruled 2026-08-18, revised]**

492 lanes cannot render at once, and 288 of the 492 appear in exactly one
year (single-appearance musicians — the one-album oboist/harpist case John
called out). Solution: a USER-CONTROLLED appearance threshold.

- Metric: **distinct active years in the canon** (matches what lanes
  encode; album/session counts correlate but measure something else).
  Cohort sizes at each setting (verified live): ≥1 = 492, ≥2 = 204,
  ≥3 = 101, ≥4 = 57, ≥5 = 29, ≥6 = 22.
- Control: stepper/slider in the page UI (1 / 2 / 3 / 4+), filtering
  client-side — the export ships ALL 492 people with full per-year data
  (~small JSON), so the threshold is fluid and instant, no refetch.
  Default T=3 or 4 (John to pick at design review).
- Label honestly: "active in at least N years of the canon."
- A search box must always be able to pull ANY person into view regardless
  of threshold (the threshold governs the default roster, never access).

## Changing of the Guard — scrub mode **[ruled 2026-08-18 as v1.5/v2 mode]**

John's callout: the meaningful roster of 1955–65 differs from 1970-on, and
the page should SIGNAL that transition. Reconciliation with the full-arc
ruling: TWO modes on the same route, same data, same lanes.

- **Atlas mode (v1, static):** full arcs as specified above. The study view.
- **Scrub mode (v1.5):** a year cursor moves across the span (user drag);
  the roster shows musicians active around the cursor, and the visual
  events are:
  - **Collapse on FINAL EXIT only** — a row collapses when the cursor
    passes a musician's last mark IN THE DATA (Chambers 1965, Brown 1956,
    Coltrane 1965). Vanishing = gone from the canon for good. This is the
    guard-change signal.
  - **Dim, never collapse, on hiatus.** Measured reality: canonical gaps
    run LONG — Mingus 7 silent years, Haden 10, Knepper 11 (absences from
    the canon, not from music). Any recency-window rule ("no activity in
    N years") would keep executing musicians who are merely between
    appearances. So: hiatus = row dims and holds position; return = row
    brightens. No threshold inference anywhere.
  - **Re-ordering is event-driven, not annual** — re-rank only when the
    active set actually changes (an entrance, a final exit, a return), with
    smooth animation. Never continuous jitter. This is John's "periodic
    trigger" made precise.
- The collapse/reorder transition IS the design moment — it's what makes
  1959→1970 feel like a different band. Budget real animation care there.
- Bebop push-back (pre-1949) and growth to 1979 both come free: the axis
  is data-driven at both ends.

## Click-through **[ruled]**

Person click → their Constellation. Person ids in the new export MUST be
the same ids `graph.json` uses, so the click-through is a lookup, never a
name-string join (same rule as places: no name-string joins anywhere).

## Required export (new file, e.g. `public/data/people-activity.json`)

Produced by export.sh (never hand-edited — ship.sh regenerates):

```json
[{
  "personId": "<same id as graph.json>",
  "name": "Paul Chambers",
  "instruments": ["double bass"],        // optional, for display
  "yearsActive": 9,
  "first": "1955-03-01",                  // earliest live-canon session date
  "last": "1965-…",                       // latest — drives the end-cap
  "sessions": [                           // album-level attribution (see caveat)
    {"date": "1959-03-02", "albumId": "miles-davis-kind-of-blue-1959"}
  ]
}]
```

Only `canon_status='included'` + `site_status` live/approved albums, matching
whatever filter the existing exports use. Multi-session albums contribute one
entry per session date. Undated sessions are omitted (counted for the
footnote).

## Non-goals for v1

- No roster animation IN ATLAS MODE (v1 is static full arcs). Scrub mode
  with collapse/reorder is v1.5 — designed above, not required at launch.
- No cloud view (considered, rejected in favor of lanes).
- No zoom; month labels fade-in at high zoom is a v2 nicety.
- No biographical data (birth/death dates) — the page speaks canon, not
  biography.

## Pitfalls

- No name-string joins — person ids only.
- Don't interpolate gap years; empty is honest.
- Don't hardcode the axis end at 1979 or 1973 — derive from data.
- Don't render the 9 undated sessions as marks anywhere; footnote only.
- Hiatus vs final exit must not be inferred from a threshold ("no session
  in 3 years = gone") — final exit is simply "last mark in the data"; the
  end-cap renders at the last mark, the faint line renders between marks.
  No prediction, no status claim beyond the data.
- ship.sh regenerates exported JSON; any shape change belongs in export.sh.

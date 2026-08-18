# Who Was Working — implementation spec (2026-08-18)

Turns `2026-08-18-who-was-working-brief.md` (McCoy) into a buildable contract.
The brief's **[ruled]** items are restated only where implementation detail is
added; where this spec and the brief disagree on a number, this spec wins — its
numbers were re-verified live under the site's actual publication gate
(see §1). Brief items still **[open]** are gathered in §6 for John's ruling.

House rules carried forward unchanged: DB → export → site one-way; no
name-string joins; never invent precision; epistemic honesty in the visuals;
light-only palette from `app/src/app.css`; every view lives under the shared
masthead.

## 1. Data reality under the export gate (verified live 2026-08-18)

The brief's counts were computed on `canon_status='included'` alone. All
existing exports gate on `canon_status='included' AND site_status IN
('approved','live')` — this feature uses the same gate, so the operative
numbers shift slightly:

| Measure | Brief | Under export gate |
|---|---|---|
| Distinct musicians | 492 | **485** |
| … with ≥1 dated session (renderable) | — | **436** |
| … with only undated sessions | — | **49** |
| Dated sessions | 257 | **254** |
| Text-only-date sessions | 9 | **9** |
| Session span | 1949-01-21 → 1973-11-28 | **1949-01-11 → 1973-11-28** |
| Cohorts ≥1/≥2/≥3/≥4/≥5/≥6 years | 492/204/101/57/29/22 | **485/201/100/57/29/22** |
| Total lane marks (person × session-date × album) | — | **1,977** |

Validation anchors reproduce exactly under the gate: Miles Davis 14 years
(1949-01-21 → 1970-01-28), Paul Chambers 9 (1955-10-26 → 1965-09-22),
Coltrane 9 (…→ 1965-06-28), Herbie Hancock & McCoy Tyner 10 each, Elvin
Jones / Ron Carter / Wayne Shorter 9 each. These become the fixtures in §7.

### The dateless-49 finding (new — not in the brief)

Five gated albums have **only** text-dated sessions:
`june-christy-something-cool-1955`, `gil-evans-out-of-the-cool`,
`stanley-turrentine-sugar-1970`, `pat-metheny-bright-size-life-1976`,
`herbie-hancock-head-hunters-1973`. Forty-nine musicians appear **only** on
those albums and therefore can never have a lane mark. Two consequences the
brief didn't surface:

- The data-driven axis ends at **1973-11-28** even though the canon holds a
  1976 album (Bright Size Life). Honest per the rules — the axis follows
  dated sessions — but the footnote must own it.
- Pat Metheny, Jaco Pastorius, and the Head Hunters band are invisible on
  this page until their sessions get real dates in the DB (workshop-side
  fix, same family as the `performance_session` backfill).

Handling is **[open D5]** in §6; recommendation: exclude the dateless from
the export, and make the footnote count both facts honestly.

Cross-checked with the mccoy-tyner session (mccoy-tyner-68, 2026-08-18): a
sixth gated album has a NULL-date session (`lennie-tristano-lennie-tristano-
1955`, text "1954-1955") but renders via its other, dated session
(1955-06-11) — the five above are the correct "can never render" set.

### Month-precision text dates **[open D7]** (from mccoy-tyner-68's inspection)

The brief ruled text-only dates excluded ("never guess them into a month"),
written as if all nine were unusable. Live inspection shows four of the nine
ARE months, verbatim — no guessing: `1973-09` ×2 (Head Hunters), `1975-12`
(Bright Size Life), `1970-11` (Sugar). And this page's marks are
month-precise by design (day precision only orders within a month). Amending
the ruling to admit **unambiguous `YYYY-MM` values only** would, with zero
DB changes:

- recover 9 musicians: Pat Metheny, Jaco Pastorius, Bob Moses; Harvey
  Mason, Paul Jackson, Bill Summers; Butch Cornell, Billy Kaye, Richard
  Pablo Landrum (verified live);
- put marks for those three albums on every participant's lane (Hancock,
  Turrentine, Ron Carter, …);
- extend the axis honestly to 1975-12;
- shrink the footnote to 5 undated sessions / 40 dateless musicians.

Independently re-derived by mccoy-tyner-68 against the DB (2026-08-18):
exact match — same 4-admitted/5-excluded partition, same 9 names, and no
gated `session_date_text` value can pass `^\d{4}-\d{2}$` while meaning
anything other than a month, so the string-length-is-precision convention
is safe.

Compound/spanning values ("1960 November 18 & 30", "1953-08/1955-07",
"1954-1955", bare "1960") stay excluded — resolving those requires DB work
(session-date whitelist extension + session-row splits), which mccoy-tyner-68
is raising with John as a workshop-queue item. This is an amendment to a
**[ruled]** brief item, so it is John's call — recommendation: **admit**.
It reads as more honest, not less: the mark lands exactly at the precision
the source gives.

## 2. Export contract — `people-activity.json`

New file produced by `export.sh` (mccoy-tyner repo), landing beside the
existing four. Never hand-edited. Shape (brief's, refined):

```json
[{
  "personId": "paul-chambers",          // _jazzcanon.person.id — same id space as graph.json
  "name": "Paul Chambers",
  "instruments": ["double bass"],       // distinct instrument names across gated performances
  "yearsActive": 9,                     // distinct calendar years with ≥1 dated session
  "first": "1955-10-26",                // earliest dated session (drives lane start)
  "last": "1965-09-22",                 // latest dated session (drives end-cap)
  "sessions": [                          // one entry per distinct (session_date, albumId)
    {"date": "1959-03-02", "albumId": "miles-davis-kind-of-blue-1959"}
  ]
}]
```

Rules:

- Gate: identical publication gate as albums.json/graph.json.
- Attribution is album-level (performance rows × that album's dated
  sessions) — `performance_session` is empty; accepted per brief.
- Dedupe at source: GROUP BY person, session_date, album (a musician playing
  two instruments is one mark; two sessions same day different albums are two).
- Undated sessions omitted from `sessions` everywhere; their count exports in
  a small metadata footer (below) so the footnote is data-driven, not
  hardcoded.
- If D7 is ruled ADMIT: `date` is either `YYYY-MM-DD` or `YYYY-MM` — string
  length IS the precision contract (same convention as places.json dates,
  which already lead with a year and carry variable precision). `meta` counts
  follow the same rule automatically.
- Sort: people by `first` then `personId`; sessions by date then albumId —
  deterministic run-to-run, clean diffs.

Metadata footer — rather than a bare array, the file is
`{"people": [...], "meta": {...}}`:

```json
"meta": {
  "spanStart": "1949-01-11",
  "spanEnd": "1973-11-28",
  "undatedSessions": 9,
  "undatedOnlyPeople": 49,
  "undatedAlbums": ["gil-evans-out-of-the-cool", "..."]
}
```

The footnote renders from `meta`; nothing on the page hardcodes counts or the
axis end (brief pitfall: canon is dripping toward 1979 and pre-1949).

### Structural invariants (added to export.sh's node validator)

- Every `personId` exists in `graph.json` people; every `albumId` in
  `albums.json` (the no-name-string-joins guarantee, enforced).
- Every person has ≥1 session entry; `first`/`last` equal min/max of their
  sessions; `yearsActive` equals the distinct-year count of their sessions.
- All dates ISO `YYYY-MM-DD`, within `meta.spanStart..spanEnd`.
- No duplicate (personId) rows; no duplicate (date, albumId) within a person.

### Pipeline wiring (mccoy-tyner repo — owned by the mccoy-tyner session)

Coordinated 2026-08-18 with mccoy-tyner-68 via cross-session messaging;
confirmed no in-flight changes to any of the three scripts. **Ownership
split**: that session implements the mccoy-tyner-side edits (export SQL
block, node-validator invariants, publish.sh snapshot list, ship.sh copy
list); this session implements everything site-side. Export contract changes
are proposal-first to John in that session too — after he ratifies this
spec, we send the finalized block shape over and they build against it.

- `export.sh`: new SQL block + invariants.
- `publish.sh`: add `people-activity.json` to the snapshot copy list.
- `ship.sh`: add to the copy-into-site list.
- **Latent gap found during spec work, confirmed by mccoy-tyner-68**:
  `places.json` is produced and validated by export.sh but `ship.sh` never
  copies it and `publish.sh` never snapshots it — hand-carried into the site
  once, silently stale on the next data ship. That session fixes it in the
  same pass.

Until the next real data ship, the site-side file is generated once by
running `export.sh` and copying manually — same bootstrap places.json used.

## 3. Site architecture (jazz-canon repo)

### Navigation

The app is a Vite + Svelte 5 SPA with no router: `App.svelte` holds
`view = 'timeline' | 'about'` and the masthead buttons flip it. The brief
wants this page (and John's forthcoming writings page) as first-class nav
destinations. **[open D3]** — two candidate shapes:

- **A (minimal):** add `'people'` to the view union + a nav button. ~10
  lines, consistent with About. No URL; not linkable.
- **B (recommended):** tiny hand-rolled hash router (~20 lines, no
  dependency): `#/people` ↔ view state, `hashchange` listener, default `''`
  → timeline. Every nav destination becomes shareable/bookmarkable, and the
  writings page inherits it for free. No Cloudflare config change (hash
  routing never touches the server).

Either way the nav button set becomes Home · People · About (label wording
**[open D6]**).

### Page layout

- Renders in `main` under the standard masthead (no new header — the
  masthead IS the SiteHeader pattern here).
- `body` keeps `overflow: hidden`; the page owns an internal scroll
  container (same pattern as `.panel-body`): vertical scroll through lanes,
  names in a left column sticky against horizontal overflow on narrow
  screens.
- Top bar of the page: title, threshold stepper, search box, mode copy.
  Footnote line at the bottom, rendered from `meta` (§2) plus the required
  epistemic copy: *"'Final exit' means last appearance in this canon — not
  death or retirement."*

### Components & modules

Following the Places pattern (pure data module + view components):

- `lib/people-data.ts` — pure derivation over the raw JSON, Node-runnable
  for verification (like `places-data.ts`): parse, index by personId, compute
  per-person year buckets, threshold cohorts, axis domain from `meta`.
  Defensive dedupe at load, matching `buildPlacesData`'s stance.
- `lib/PeopleLanes.svelte` — the page: layout, threshold stepper, search,
  scroll container, footnote.
- `lib/Lane.svelte` (or inline) — one row: name label, faint full-span
  line between first/last, marks at month-resolved x positions, end-cap
  glyph at `last`. 1,977 marks total at T=1 — one flat SVG per lane (or one
  page-wide SVG) renders trivially; no virtualization, no canvas, no
  dependency.
- `lib/data.ts` — `loadPeopleActivity()` following the existing memoized
  pattern.

### Lane rendering (brief rulings, made concrete)

- X-axis: year ticks 1949 → `meta.spanEnd` year (both data-driven). Mark x
  = month-exact position; day precision orders same-month marks.
- Marks: small dots in `--bn-blue`; hover reveals album title + date
  (title-attr or light tooltip; no new dependency).
- Between-marks line: 1px `--line`-grade stroke — visible enough to say
  "still in the story," faint enough that marks dominate. Hiatus is just
  this line continuing; no special casing.
- End-cap at `last`: a short terminal tick — quiet, not funereal.
- Same person, same month ×2 (max depth 2, verified): render side-by-side
  ordered by day **[open D2 — jitter vs ×2 glyph; settle at preview]**.
- Click anywhere on a lane row → `nav.openPerson(personId)` → the existing
  Constellation FloatingWindow. Pure id lookup; ids shared with graph.json
  by construction (§2 invariant).

### Threshold + search (brief rulings)

- Stepper: 1 / 2 / 3 / 4+ distinct active years; label "active in at least
  N years of the canon." Cohort sizes: 485 / 201 / 100 / 57. Default
  **[open D1: T=3 (100 lanes) vs T=4 (57 lanes)]**. Client-side filter,
  instant, no refetch.
- Page-local search over the 485 exported names (not the site-wide Search
  component): match pulls that person's lane into view and highlights it
  regardless of threshold. Threshold governs the default roster, never
  access.

### Lane ordering **[open D4]**

The brief doesn't rule Atlas-mode ordering. Options: (a) by `first` date —
arrival order; the changing of the guard reads as a diagonal front even in
the static view; (b) by `yearsActive` desc — the long-haulers on top;
(c) alphabetical. Recommendation: **(a) arrival order**, with ties by
`personId`.

### Responsive

Desktop-first; the axis needs width. On phones: name column stays sticky,
lane field scrolls horizontally. Verified at the preview gate, not
speculated about here.

## 4. Scrub mode (v1.5 — designed, not built now)

Everything in the brief's "Changing of the Guard" section stands: same
route, same data, a mode toggle; collapse on final-exit only; dim-never-
collapse on hiatus; event-driven re-ranking. Nothing in v1's structure may
preclude it — concretely: lanes are rendered from a derived, ordered roster
array (not hardcoded positions), so a future mode can animate that array.
No other v1.5 provision is made.

## 5. Non-goals for v1 (brief, unchanged)

No roster animation in Atlas mode; no cloud view; no zoom; no biographical
data; no `performance_session` backfill (workshop-side, separate).

## 6. Decisions — ALL RULED by John, 2026-08-18

| # | Decision | Ruling |
|---|---|---|
| D1 | Default threshold | **T=4** (57 lanes first paint) |
| D2 | Same-month ×2 marks | **day-ordered jitter**, settled at visual preview |
| D3 | Navigation shape | **hash router** — route `#/working` |
| D4 | Atlas lane ordering | **arrival order** (by `first`, ties by `personId`) |
| D5 | The dateless musicians | **exclude from export**, counted in footnote |
| D6 | Nav label / page title | **"Working"** (John's working name, his call) |
| D7 | Month-precision text dates | **admit** verbatim `YYYY-MM` values |

Added at ratification: the page carries an **introduction text block** above
the lanes — John's editorial voice, filled with lorem ipsum until he writes
it. The copy lives in a plain-text file (`?raw` import), editable without
touching code.

Related but NOT a decision here: extending the `session` edit-contract
whitelist to `session_date` and authorizing session-row splits for the
compound values — mccoy-tyner-68 is raising that with John as a
workshop-queue item. If it lands later, this page inherits the new dates on
the next export with no code change.

## 7. Verification plan

- `npm run check` is the only static gate (no test suite in repo).
- `people-data.ts` is Node-runnable: a verification script asserts the §1
  anchors against the real export (Miles 14 years 1949-01-21→1970-01-28,
  Chambers 9 years →1965-09-22, cohort counts 485/201/100/57) — real-data
  checks, not transcribed expectations.
- export.sh invariants run on every export (§2).
- Visual verification via the established playwright-core + cached headless
  shell recipe against `npm run dev`, using the dev-only `__nav` seam;
  screenshots at desktop/iPad/phone widths for John's preview gate before
  visual sign-off (rendered previews against real data — standing rule).

## 8. Build order (preview of the plan, not the plan)

1. Export: SQL + invariants + pipeline wiring + places.json gap-fix
   (mccoy-tyner repo), bootstrap copy into the site.
2. Data layer: types, `loadPeopleActivity`, `people-data.ts` + anchor
   verification script.
3. Route/nav (per D3) + static page skeleton.
4. Lanes rendering + threshold + search + footnote.
5. Visual preview gate (screenshots, John rules D2 and any tuning).
6. Polish + `npm run check` + final review.

Detailed task plan follows in a separate doc once John rules on §6.

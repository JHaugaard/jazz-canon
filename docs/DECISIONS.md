# DECISIONS.md — The Jazz Canon (Fable 5 build)

Living record of every architectural and design decision for this build.
Started 2026-07-02 at the proposal gate; updated whenever a decision is made
or revised during implementation.

Status legend: **PROPOSED** (awaiting go-ahead) · **ACCEPTED** · **REVISED** · **NOTED** (minor call made autonomously during the build)

---

## D1. Database — Postgres 16, scratch database on the existing local instance

**Status:** ACCEPTED (gate response, 2026-07-02)

**Decision:** Restore the dump exactly as shipped into a fresh database named
`jazzcanon_fable` on the Postgres 16 instance already running locally on port
5433 (via the passwordless `sudo -u postgres` path verified this session). No
engine migration.

**Rationale:** The dump targets Postgres 16.14 and the machine runs exactly
that version. Any migration (SQLite, DuckDB) adds a conversion step that can
only introduce errors and buys nothing — the database is used only at
build/export time (see D2), so engine weight is irrelevant at runtime.

**Considered and rejected:**
- *SQLite migration* — pointless translation risk (enums, uuid defaults,
  views, `\restrict` dump directives); no runtime benefit since the app never
  queries a live DB.
- *Restoring into the shared `postgres` database* — the dump creates schema
  `_jazzcanon`, which would collide with the production schema of the
  reference project living on this same instance. A separate scratch database
  is the isolation boundary; `dropdb jazzcanon_fable` is the kill switch.

**Risk:** none identified beyond collision, which the scratch DB eliminates.
Production data is never touched; the read-only role is not used.

---

## D2. Data-serving model — build-time static export to JSON

**Status:** ACCEPTED (gate response, 2026-07-02)

**Decision:** A single export script (`scripts/export.mjs`, Node + `pg`) runs
at build time against the restored database and emits static JSON into the
app's assets:

- `data/albums.json` — all 100 album cards (timeline payload: id, title,
  artist, year, style, label, catalog number, art path, apple_album_id).
- `data/albums/<album-id>.json` — per-album deep-dive detail (header fields,
  recording info + studios, tracklist with per-track personnel and epistemic
  labels, de-duplicated full-album personnel). Lazy-loaded on card click.
- `data/graph.json` — the full performance edge list (person ↔ album, with
  instrument and epistemic label) plus person names/slugs. ~670 edges; the
  Personnel Network ego graph for any musician is computed client-side from
  this one small file.

**Rationale:** The dataset is fixed, read-only, and tiny (100 albums / 567
people / 666 tracks / 670 performances — low hundreds of KB as JSON). A live
API server would be a permanent operational component serving immutable data;
a static export makes the production artifact a plain static site: zero
attack surface, zero maintenance, free hosting, instant loads. This also
matches the owner's standing simplicity/operability constraints.

**Considered and rejected:**
- *Live Postgres-backed API* — permanent process + DB dependency to serve
  data that changes never (canon fixed at 100 for this benchmark). Growth is
  a re-export, not an architecture problem.
- *GraphQL layer* — dramatic overkill at this scale.
- *One giant JSON bundle* — acceptable size-wise, but per-album lazy detail
  keeps first paint minimal; the split costs nothing.

**Risk:** derived-data bugs in the export (e.g. track-personnel scope logic).
Mitigation: the export reuses the database's own shipped views
(`v_track_personnel`, `v_album_personnel`, `v_album_card`) rather than
re-deriving join logic, and asserts expected counts (100/567/666/670) before
writing files.

---

## D3. JavaScript framework — Svelte 5 + Vite, static single-page app

**Status:** ACCEPTED (gate response, 2026-07-02)

**Decision:** Vite + Svelte 5, built as a fully static SPA (no SSR, no
meta-framework). TypeScript throughout.

**Rationale:** The app is one screen (timeline) plus two overlay panels (deep
dive, network) — there is no page routing to speak of, so a meta-framework's
main gift (file-based routes, SSR) is dead weight. What the app *is* is a
custom, interaction-heavy visualization: horizontal scroll timeline, slide-in
panels, an SVG force graph. Svelte's fine-grained reactivity and low
ceremony suit hand-built visualization components well, and the compiled
output is small.

**Considered and rejected:**
- *React + Vite* — perfectly viable, but more boilerplate for stores/panel
  state and heavier runtime for zero functional gain here.
- *SvelteKit (adapter-static)* — brings routing/SSR machinery this
  single-view app doesn't use; plain Vite is the simpler thing that works.
- *Vanilla JS/D3 only* — the panel state machine (timeline → album → network
  → album → …) wants declarative components; vanilla gets spaghetti fast.

**Risk:** none structural. Svelte 5 runes are stable and well-documented.

---

## D4. Graph rendering — d3-force layout + hand-rendered SVG

**Status:** ACCEPTED (gate response, 2026-07-02)

**DOM-ownership boundary (made explicit):** `d3-force` is used strictly as a
position calculator — no d3 selections, no d3-owned DOM. Svelte owns the
entire SVG tree; the simulation's tick handler updates reactive position
state, and Svelte re-renders. Node/edge click and hover handlers are plain
Svelte event bindings. This removes the classic two-owners-of-the-DOM
conflict between a framework's reactivity and a graph library's internal
mutations — there is exactly one owner (Svelte), and d3 never touches an
element.

**Decision:** Use `d3-force` (the layout engine only) to position nodes, and
render the graph as plain SVG elements inside a Svelte component. Star-biased
initial layout: clicked musician pinned center, their albums on an inner
ring, secondary musicians outer; forces (link, many-body, collision) relax it
from there. Node radius scales with shared-album count; edge stroke width
with collaboration weight; instrument shown on hover; click album node →
deep dive, click musician node → re-center.

**Rationale:** Ego-scoped graphs here are small (the busiest sidemen sit on
~15–25 canon albums; a scoped graph is well under ~250 nodes), so SVG is
plenty fast and gives pixel-perfect control to match the locked brand
(colors, Oswald labels, epistemic styling) — the thing canvas/WebGL libraries
make hard.

**Considered and rejected:**
- *force-graph / sigma.js (canvas/WebGL)* — built for thousands of nodes;
  styling and label typography control are worse, and we never exceed a few
  hundred.
- *cytoscape.js* — capable but brings its own styling DSL that fights the
  brand CSS.
- *Pure CSS/positioned HTML* — insufficient for weighted edges.

**Risk:** legibility for the highest-degree musicians (the Paul Chambers
case — which is also the app's whole point, so it must be good). Mitigation:
verify worst-case node counts from real data right after restore; collision
force sized to node radius; secondary-musician labels appear at hover/zoom
rather than all-at-once if count exceeds a threshold.

---

## D5. Hosting — Cloudflare Pages (prepared, not deployed)

**Status:** ACCEPTED — **locked by owner** at the gate (2026-07-02): "Let's
consider Cloudflare to be a lock."

**Decision:** Target Cloudflare Pages for the static build. Prepare the
config and exact `wrangler pages deploy` command; **do not deploy** — that
call is the owner's.

**Rationale:** The artifact is a static directory (HTML/JS/JSON/images).
Cloudflare Pages serves it from a global CDN on a free tier with zero
servers to maintain. Total site weight including all 100 covers is roughly
10 MB — comfortably inside all Pages limits.

**Considered and rejected:**
- *Fly.io* — the owner's usual target for *apps with servers*; running a
  container to serve static files is footprint without function.
- *VPS + Caddy* — same objection: a maintained process for immutable files.

**Risk:** none technical. If the owner prefers a different static host, the
build output (`dist/`) is host-agnostic and the decision reverses freely.

---

## D6. Cover art — serve directly from `album_art.source_url`

**Status:** REVISED at the gate (2026-07-02) — owner's call, overriding the
original bundle-locally proposal.

**Decision:** The app references each album's primary front-cover
`source_url` (Cover Art Archive / iTunes CDN) directly in `<img>` tags. No
downloading, no bundling, no local copies. `loading="lazy"` on timeline
cards; a branded no-art placeholder (palette-consistent) renders on image
error or absence.

**Data facts:** all 100 albums have exactly one `is_primary` front-cover
row and all 100 carry a `source_url` (to be re-verified against the
restored database).

**Original proposal (rejected by owner):** bundle covers as local static
assets to avoid third-party dependency. Owner's assessment: URL serving is
the known-best approach for this project; not worth tokens/turns re-litigating.

---

## D7. Apple Music links — album-level links, plain URLs, in scope for v1

**Status:** PROPOSED

**Decision:** Render "Listen on Apple Music" as a plain outbound link
(`https://music.apple.com/us/album/{apple_album_id}`) on the 98/100 albums
that have an ID. No MusicKit, no API, no auth. Track-level links: the data
currently has **zero** `apple_track_id` values across all 666 tracks, so the
conditional render is implemented (one line) but will not appear with
current data.

**Rationale:** The brief marks Apple Music as optional/stretch, but plain
deep links cost nearly nothing and deliver the feature for 98% of albums.
MusicKit embedding is where the real cost lives — that's what stays out.

**Status update:** ACCEPTED with the rest of the proposal at the gate
(2026-07-02). D7–D10 drew no objection in the gate response.

---

## D8. Epistemic + editorial visual encoding

**Status:** PROPOSED

**Decision:** Within the locked palette (style-guide.md):
- `obs` — normal weight body text, ink color. No badge (the quiet default).
- `inf` — italicized, muted, with a small amber "inf" marker; amber family
  per the style guide's explicit allowance.
- `unk` — amber marker with `?`, visually distinct from `inf` by weight and
  marker text, same hue family (per style guide: differ by weight/marker,
  not hue). Tooltip explains "uncertain — not incorrect."
- Editorial content (album `description`) — Lora italic serif on a faint
  amber-tinted panel, explicitly labeled "Editorial note". Never shares
  styling with sourced-fact rows.
- No red anywhere; no traffic-light semantics.

**Data note:** `album.description` is currently empty for all 100 albums, so
the editorial-note block will not render with current data. It is built and
conditional regardless, since the brief specifies it and the data may grow.

---

## D9. Timeline layout approach

**Status:** PROPOSED

**Decision:** A horizontally scrolling strip (native scroll + drag), year
axis 1949–1972, fixed pixels-per-year scale tuned so the 1958–1961 density
reads as pleasantly busy rather than broken (albums cluster per year and
stack vertically within a year column; real distribution peaks at ~9 albums
in one year). Era bands are translucent absolutely-positioned layers behind
the cards using the four locked era tints, with labels using
`position: sticky` so they stay readable at any scroll position (brief
requirement). Progressive disclosure comes free: the viewport only ever
shows temporally-nearby albums, which is the brief's stated intent — no
extra filtering mechanism is built.

**Risk:** vertical overflow in dense years on short viewports. Mitigation:
card size tuned against the real max-per-year count; tested at common
viewport heights during the build.

---

## D10. Panel navigation model

**Status:** PROPOSED

**Decision:** A single navigation stack store, entries typed
`{kind: 'album', id}` or `{kind: 'person', id}`. Card click pushes an album
panel; musician click pushes a network panel; album-node click pushes
another album panel; back/dismiss pops. The timeline never unmounts and
keeps its scroll position. This directly implements the brief's discovery
loop (timeline → album → musician → network → album → …) with an obvious
"how did I get here" trail and cheap back navigation.

---

## D11. Out-of-scope confirmations

**Status:** NOTED

Explicitly not built, per BRIEF.md §8 and §4: search box, full-network view,
venue map, comparison matrix, instrument filter, sideman search, influence
tree, admin, accounts, dark mode (brand is light-only). Tables in the dump
that v1 never reads (`citation`, `source` — both empty anyway;
`collection`; `person_name_variant`; `fn_degrees_between`) are restored
faithfully but unused by the export.

---

## D12. Export format — three files, not per-album files

**Status:** NOTED (build-time minor call, revising the D2 file layout)

`details.json` ships as one file keyed by album id (660 KB raw, lazy-loaded
on first card click, gzips to a fraction of that) instead of 100 separate
files. One request beats 100 tiny ones at this scale; albums.json (32 KB)
alone drives first paint. Export runs via `psql` JSON aggregation
(`scripts/export.sh`) — no Node DB driver, no credentials in the app tree,
count assertions built in (fails loudly on any mismatch).

## D13. Where the epistemic labels actually live

**Status:** NOTED (data reality discovered post-restore)

All 670 performance rows are `obs`. The `inf`/`unk` labels live on tracks
(62 `inf`, 4 `unk` via `track.epistemic_track`) and production credits
(56 `inf`, not a v1 surface). Consequences:
- Track rows in the Deep Dive carry the epistemic treatment (title
  italicized + amber marker for `inf`, `?` badge for `unk`).
- Musician-row epistemic rendering is still implemented per the brief
  (labels ride through the export untouched), it just renders all-`obs`
  with current data.
- 21 performances have `scope = 'unknown'`: they appear in the full-album
  personnel list but under no individual track (faithful to
  `v_track_personnel` semantics — we don't know which tracks they're on).
  The full-personnel row notes "selected tracks" / "track assignment
  unknown" scope so the distinction is visible.

## D14. Verification method

**Status:** NOTED

Three layers, run at each milestone:
1. **Export assertions** — `scripts/export.sh` hard-fails unless the restored
   DB matches 100/567/666/670 and the emitted JSON re-verifies (100 albums,
   666 tracks, 670 performance entries, 98 Apple IDs, art URL on all 100).
2. **Scripted discovery-loop walk** — `app/scripts/walk.mjs` (Playwright,
   headless Chromium) drives the *production build*: timeline → Kind of Blue
   deep dive → personnel expand → Paul Chambers network → album node → second
   album deep dive → re-center on another musician → back → close. Screenshots
   at every step, console errors captured. Run after every significant UI
   change.
3. **Fresh-context verifier subagent** — audits source + screenshots against
   BRIEF.md/style-guide.md checklists with no knowledge of the build's
   history; findings triaged and fixed.

## D15. Header lockup inlined as SVG markup

**Status:** NOTED

`brand/logo-lockup-horizontal.svg` contains live `<text>` using the Oswald
webfont via CSS `@import` — inside an `<img>`, browsers block external font
fetches, so the wordmark broke. Fix: the lockup is inlined as SVG markup in
the app header (asset file untouched), where it uses the Oswald the page
already loads. This is exactly the failure mode the asset's own comment
warns about.

## D16. Verifier findings triage (fresh-context audit, 2026-07-02)

**Status:** NOTED — verdict was PASS WITH FINDINGS, zero blockers.

Fixed:
- Two Inter micro-labels used `text-transform: uppercase` (the style guide's
  named anti-pattern token) → switched to `font-variant: small-caps`.
- Deleted unreferenced `src/assets/vite.svg` scaffolding (contained the only
  dark-mode CSS in the tree).
- Captured screenshot evidence of the `unk` epistemic badge rendering
  (The Sermon! — "Flamingo" track) since the main walk happened to land on
  all-`obs` albums.

Accepted as design interpretation, no change:
- Era bands render as four parallel lanes rather than color-blended
  overlays; temporal overlap is visible and unresolved, which is the
  requirement (BRIEF explicitly leaves visual encoding open).
- The center (selected) musician node is larger than album nodes; the
  brief's "album larger than musician" sizing governs the two node
  *classes*, and secondary musicians respect it. Focal emphasis on the
  center is deliberate.
- "Leader" row in the Recording section — a sourced fact beyond §5.2.4's
  enumerated items; kept as a benign, clearly-sourced addition.
- `description` empty on all 100 albums and personnel-level epistemic
  uniformly `obs` — data realities already recorded in D8/D13; code paths
  exist and are exercised where data exists (62 inf / 4 unk track badges).

## D17. Fine-tuning round 1 (owner notes, 2026-07-02, post-v1)

**Status:** ACCEPTED (owner-directed changes, all implemented and verified)

1. **Header 2×** — masthead 64→112 px, lockup 42→84 px; panel offsets track a
   `--masthead-h` variable.
2. **"Constellation" naming** — the Personnel Network view is titled
   **Constellation** (upper-left of its window bar; also the accessibility
   label). No other "Personnel Network" strings existed in the UI.
3. **Constellation is now a large draggable window** — min(1300px, 96vw) ×
   min(84vh, 940px), centered by default, draggable by its title bar,
   position clamped to the viewport. (Replaces the right-anchored panel for
   this view; the Album Deep Dive keeps its slide-in panel.)
4. **All musician names always visible** — the previous label threshold
   (shared ≥ 2 or small graphs) was a space-management choice, not a bug;
   removed. Collision radii and link distances increased to give labels
   room; canvas grew to 1240×820 viewBox units.
5. **Nodes are draggable** — grab any node to reshape/spread the graph;
   dragged nodes stay pinned where dropped, double-click releases them back
   to the simulation (center stays anchored). Implementation keeps the D4
   DOM-ownership rule: drag writes `fx`/`fy` and reheats the simulation;
   d3 still never touches DOM. A pointer-capture subtlety was caught by the
   scripted walk (capturing on the SVG killed node clicks; capture on the
   node itself fixes it).
6. **Era bands ready for growth** — lane geometry is now computed from the
   `ERA_BANDS` array length; adding Free Jazz/Fusion later = one array entry
   + one tint token in app.css (+ raise `END_YEAR`). Nothing else changes.
7. **Year axis moved to the top** of the timeline, above the cards, keeping
   it in view and reserving the bottom of the window for future info
   surfaces.

Verified by: svelte-check clean, production rebuild, full discovery-loop
walk (10 screenshots, no console errors), plus a dedicated drag test
(node drag, window drag from (740,129)→(413,189), click-after-drag).

## D18. Constellation refinement round 2 (owner notes + Claude-constellation reference, 2026-07-02)

**Status:** ACCEPTED (owner-directed; guided by two reference screenshots in `screenshots/`)

Owner supplied `screenshots/claude-constellation.png` (target aesthetic) and
`screenshots/fable-constellation.png` (prior state). Changes:

1. **Header restructured to match the reference.** The draggable top bar now
   leads with the musician **name** (large, ink) plus a single instruction
   line ("Click an album to open · click a musician to follow the thread ·
   drag to rearrange · scroll to zoom"). The word **"Constellation"** moved
   to a strip *below* the bar (left), with the stats
   ("piano · 4 canon albums · 16 collaborators") beside it and a
   "Reset view" button at the right. The old separate legend box is gone —
   its content folded into the instruction line.
2. **Bigger nodes, wider spread.** Radii raised (center 40, album 30,
   musician 13–28) and forces strengthened (charge, link distance, collision)
   on a larger 1600×1040 viewBox, matching the reference's spacious feel.
3. **Zoom + pan + auto-fit.** Scroll-to-zoom (toward cursor), background
   drag-to-pan, and a one-time auto-fit that frames the whole graph once the
   simulation settles (`sim.alpha() < 0.06`). This makes both tiny (Art
   Pepper: 2 albums) and huge (Paul Chambers: 72 nodes) graphs open
   well-framed. "Reset view" re-fits. Node-drag coordinates use
   `getScreenCTM().inverse()` so they stay correct under any zoom/pan (still
   honors the D4 rule — d3 computes positions, Svelte owns the DOM).
4. **Window larger and resizable.** Default grew to
   min(1640px, 97vw) × min(1160px, available height below the masthead), and
   a bottom-right grip drag-resizes it (min 560×420, clamped to viewport).
   Height is now derived from `calc(100vh - masthead - 4vh)` so the window —
   and its resize grip — always stay fully on-screen (the earlier
   fixed-90vh value pushed the grip ~23px below the fold).

Verified: svelte-check clean; production build; discovery-loop walk (no
console errors); node-drag + window-drag tests; resize test
(1630×896 → 1320×666); constellation captures for Horace Silver (reference
match), Paul Chambers (dense), and Art Pepper (small) all framed without
clipping. Test scripts live in `app/scripts/`.

## D19. Refinement round 3 (owner notes, 2026-07-02)

**Status:** ACCEPTED (owner-directed; reference `screenshots/30-second-play-button.png`)

1. **Node dragging fixed (real bug).** Symptom: dragging a node barely moved it
   or seemed to move a different one. Two root causes: (a) grabbing was hard —
   the pointer often hit the label/background and started a pan (which shifts
   everything slightly); (b) more fundamentally, the render only updated when
   `zoom` ($state) changed — reassigning the `nodes` array with the *same*
   object references does not re-render keyed `{#each}` items in Svelte 5, so
   per-tick position changes never reached the DOM (the one-time auto-fit's
   zoom change is what made the *load* look animated). Fix: separate the
   stable d3 simulation objects (`simNodes`/`simLinks`) from per-frame render
   **clones** pushed to `$state` (new references each tick → keyed each
   re-renders); drag now resolves the live sim node by id and pins its fx/fy;
   added invisible enlarged hit-circles so nodes are easy to grab; pointer
   move/up handled at the window level. Verified: a node now tracks the cursor
   1:1 (292–300px drag → 292–300px move).
2. **Header lockup.** Rebuilt as mark + wordmark sharing a baseline: only the
   record mark scaled up (~1.2×), "A Jazz Canon" / "Jazz on Record" text
   unchanged, on one baseline. Removed the right-side "100 albums · 1949–1972"
   line (it would date). The lockup is now a Home button.
3. **About page.** New `About.svelte`, brand-styled (Oswald headings, Lora
   lede + editorial note, amber tagline), placeholder copy. Reached via a
   Home / About nav at the right of the masthead; simple `view` state switch,
   no router (single-view app).
4. **Per-track 30-second previews.** New build step
   `scripts/enrich-previews.mjs` looks each album up in the public iTunes API
   and matches songs to our tracks by track number / title, writing
   `previewUrl` (and Apple track id) into `details.json`. Coverage: 640/666
   tracks (the 26 gaps are the 2 Apple-less albums plus a few unmatched
   titles). The Deep Dive renders a circular play button per track that plays
   the preview inline (one shared audio element), plus a "Play album previews"
   button that plays straight through. **This step runs AFTER `export.sh`**
   (which regenerates details.json) and needs network; it is resilient —
   any album that fails to look up is simply left without previews.
5. **Swim-lane overlap.** `eraLane()` now overlaps consecutive lanes by ~20%
   so the translucent era tints blend where eras genuinely coexist; the genre
   pill drops into each lane's clean (single-colour) zone so labels stay
   legible. Adding a future era (Free Jazz, Fusion) is still one array entry.
6. **Year axis** already at the top from D17; unchanged.

Verified: svelte-check clean; production build; discovery-loop walk (no
console errors); drag test (300px); audio playback confirmed; About + header
+ swim-lane captures reviewed. Test scripts in `app/scripts/`.

## D21. Refinement round 4 (owner notes, 2026-07-02)

**Status:** ACCEPTED (owner-directed)

1. **Album nodes stay cover-art thumbnails** (not amber discs) — owner
   confirmed. Fixed the sparse-graph size jump: the auto-fit was magnifying
   small constellations (k up to 2.0), so they loaded at natural size then
   jumped larger once the fit ran. `fitView` now caps k at 1.0 — it only ever
   shrinks big graphs to fit, never magnifies. Verified: a lone center node
   stays 59px on load and after settle.
2. **Constellation modal breathing room** — window bar padding 10→14/26px and
   the graph content padding widened, so the name/guide, the
   Constellation/stats/Reset row, and the graph all sit in from the edges.
3. **Responsive (new, beyond spec).** Targets iPad first, phone as a bonus:
   - Layout heights use `dvh` to avoid mobile browser-chrome clipping.
   - Breakpoints at 1024px (iPad) and 620px (phone) scale the masthead,
     lockup, and nav; on phone the Deep Dive panel goes full-width and the
     Constellation becomes a full-screen sheet (no floating drag/resize).
   - About, Deep Dive, and Constellation content all have phone tuning.
   - **Touch:** node-drag, background-pan, and tap all work via pointer
     events; added **two-finger pinch-zoom** for iPad (desktop keeps
     scroll-to-zoom). "Reset view" and auto-fit cover the rest.
   - Known limits: very dense constellations (58+ collaborators) are cramped
     on a phone — usable via pinch/pan but best on iPad+. No dark mode
     (brand is light-only).

Verified: svelte-check clean; production build; captures at iPad portrait,
iPad landscape, and phone (390px) for timeline, Deep Dive, and Constellation;
single-pointer drag regression (300px); discovery-loop walk. Scripts in
`app/scripts/` (responsive-shots.mjs, audio-check.mjs, etc.).

## Build-time observations affecting decisions

- `performance_session` is empty (0 rows) → `v_musician_timeline` yields
  nothing; irrelevant to v1 (session dates come via `session` table for the
  recording-info block).
- Style distribution: Hard Bop 29 · Cool 28 · Modal 21 · Post-Bop 16 ·
  Soul Jazz 6. Soul Jazz has no era band in the brief's four-band spec;
  Soul Jazz albums display their style label on cards but sit within the
  Hard Bop band's time range, which is historically coherent and what the
  brief's four-band list implies.
- Year range in data is 1950–1972 (no 1949 albums, though the axis starts
  at 1949 per the brief).

---

## D22. Search + refinement round 5 (Fable 5 review, 2026-07-07)

**Status:** ACCEPTED (owner picked scope from the review findings)

A full look/feel/function review (production build driven headlessly at
1512/1024/390px; code pass) led to one feature and three refinements:

- **Unified search** (`Search.svelte`, masthead): typeahead over the 567
  musicians in `graph.json` and the 100 albums in `albums.json`, built
  client-side on first focus — no new data files. Selecting a musician opens
  their Constellation (`nav.openPerson`); selecting an album opens its deep
  dive (`nav.openAlbum`). Diacritic-folded matching, ranked
  starts-with > word-prefix > substring; musicians disambiguated by
  instruments + canon-album count. `/` focuses the field; on phones the
  field collapses to an icon that drops a full-width bar under the masthead.
- **Constellation canvas follows the stage aspect** (`Network.svelte`): the
  viewBox width is derived from the window's shape at graph-build time
  (H=1040 fixed, W clamped 560–2600), and the auto-fit cap rose from k≤1 to
  k≤1.6. Fixes the letterboxed miniature on phones and lost-looking sparse
  graphs; the "never jump huge" guard survives via the 1.6 cap.
- **Era chips restyled as pinned map labels** (`Timeline.svelte`): solid
  paper background, hairline border, soft shadow. Tried and rejected:
  sliding the chips *under* the cards (kept cards pristine but hid the
  labels through dense stretches and left odd slivers in card gutters).
  A crisp opaque label that occasionally rides over a card corner reads as
  intentional; the translucent text-on-text collision was the real defect.
- **Vertical mouse wheel pans the timeline** (`Timeline.svelte`): manual
  non-passive `wheel` listener (Svelte markup wheel handlers are passive);
  trackpad deltaX and ctrl+wheel zoom keep native behavior.

Deferred by owner choice: self-hosted cover art (CAA hotlink latency/500s),
label decluttering in dense constellations, hash deep-links, misc. nits
(reduced-motion, preview progress, richer loading state).

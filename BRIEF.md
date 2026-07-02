# The Jazz Canon — Public App Design Spec (Benchmark Edition)

**Status:** Benchmark packet — adapted 2026-07-01 from the original v1 spec
**Author:** John Haugaard
**Intended audience:** a model under evaluation (e.g. Claude Fable 5, or any other
LLM/agent) tasked with building this app independently.

This document defines *what* to build. Stack, framework, serving model, and hosting
are open decisions — propose them with rationale. The spec below is binding on
everything else.

**Context you should know:** a working reference implementation of this app already
exists and has shipped. It is intentionally not included here. Your job is to
develop the concept, the UI/UX, and the Personnel Network graph independently from
this spec and the data you're given — not to reproduce someone else's screens.
You have one real advantage the original build didn't start with: direct access to
the full, already-curated database (see §6) from day one, rather than building the
data pipeline first.

---

## 1. Overview

The Jazz Canon is a curated set of ~100 canonical jazz albums (post-bebop through
pre-Fusion, ~1949–1972) with track-level personnel records for every album. The data
is fully built and provided to you as a database dump (see §6).

The app is a **personal discovery tool** — for exploring the music, the musicians,
and the web of collaboration that defined an era. It is read-only, single-user in
spirit (no logins, no user-generated content), and built to be shared.

**The core value proposition, in the owner's words:**
> *"Being able to easily find the Paul Chambers nugget is just what I want to be able
> to do."*

Paul Chambers was the bassist on more canonical sessions than almost anyone. The app
should make that kind of hidden-connective-tissue discovery feel natural, even
inevitable.

---

## 2. Scope Guardrails

**In scope:** Cool Jazz, Hard Bop, Soul Jazz, Modal Jazz, Post-Bop. Roughly
1949–1972, but the governing test is spirit, not year: *does it swing with
structure, post-bebop, and pre-Fusion?*

**Out of scope:** Pre-1949 bebop, Free Jazz (Ornette Coleman, late Coltrane
post-1965), Fusion (Bitches Brew, 1970, is the hard marker). No contemporary jazz,
no concert listings, no transcriptions, no user accounts.

The canon is fixed at 100 albums for this benchmark. Growth is a data-pipeline
concern, not an app-architecture concern — the app renders whatever is in the data.
See `docs/genre-definitions.md` for the fuller scope-boundary reasoning.

---

## 3. Epistemic Rules

This is non-negotiable and must inform every design decision.

The dataset carries an `epistemic` label on every personnel fact:

| Label | Meaning | Display treatment |
|-------|---------|-------------------|
| `obs` | Directly observed (liner notes, primary source) | Normal weight |
| `inf` | Inferred (session lists, cross-references) | Italicized or muted |
| `unk` | Uncertain | Visually distinct, possibly with a `?` marker |

**Two categories of information must never look the same:**

1. **Sourced facts** (who played what, on which track, on which date, at which
   studio) — these carry epistemic labels and are the project's primary asset.
2. **Editorial interpretation** (mood tags, "influence" lineage, "key track"
   designations) — clearly labeled as editorial, visually distinct from sourced
   facts.

The Personnel Network (§5.3) is sourced. An Influence Tree would be editorial.
Never let tidy presentation launder opinion into fact. How you encode this
visually is your call — see `style-guide.md` for the available brand palette,
but the distinction itself is a hard requirement, not a suggestion.

---

## 4. Feature Plan

### v1 — Ships first
- Horizontal timeline homepage
- Era bands (visual context layer behind the timeline)
- Album Deep Dive panel (slide-in)
- Personnel Network panel (triggered by musician click)
- Apple Music links (per album and per track where IDs exist — optional, treat as
  a stretch feature if Apple/MusicKit integration is out of scope for your run)

### v2 — After v1 is stable
- Venue Map (geocoded studios, Van Gelder as supernode)
- Comparison Matrix (side-by-side album attributes, shared-personnel highlight)
- Instrument filter (faceted browse by instrument family or specific instrument)
- Sideman search (musician-first entry point)

### v3 — When the data and editorial layer are ready
- Influence Tree (lineage dendrogram — requires explicit editorial tagging,
  clearly labeled as interpretation not sourced fact)

v2/v3 are out of scope for this benchmark unless you have time to spare — the
core test is v1.

---

## 5. v1 Screens

### 5.1 Timeline Homepage

**This is the primary entry point and the main navigation metaphor.**

The user travels through time. Albums appear at their recording year. The UI is
never overwhelming because the viewport shows only what is temporally nearby.

**Layout:**
- Full-width horizontal timeline. Year axis spanning ~1949–1972.
- Album cards anchored to their recording year (`album.year`). Cards cluster at
  years with multiple recordings (1958–1961 will be visibly dense).
- Behind the timeline: overlapping colored era bands. Four bands:
  - Cool Jazz (~1949–1958)
  - Hard Bop (~1955–1965)
  - Modal Jazz (~1958–1972)
  - Post-Bop (~1962–1968)
  - Bands overlap where the eras genuinely coexist — that overlap is historically
    accurate and should be visible, not resolved.
- Era band labels are always readable regardless of scroll position.

**Album card (minimal):**
- Cover art (primary image from `album_art` table, `is_primary = true`)
- Title
- Artist name
- Year badge overlaid on the cover art (bottom-left)
- Primary style label (e.g. "Hard Bop", "Modal Jazz")

**Interaction:**
- Horizontal scroll/drag to move through time. Smooth, not paginated.
- Click an album card → opens Album Deep Dive panel (§5.2). Timeline stays in
  place.
- No default search box. The timeline IS the browse mechanism.

**Progressive disclosure principle:**
As the user is in the early 1950s, musicians who are active only in the late
1960s (e.g. Keith Jarrett) should not appear anywhere in the UI. By 1970,
musicians whose careers peaked in the mid-1950s (e.g. Paul Chambers, d. 1969)
recede naturally. This is not a filter — it is the natural consequence of a
time-anchored view.

---

### 5.2 Album Deep Dive Panel

**Triggered by:** clicking an album card on the timeline.
**Behavior:** slides in from the right. The timeline remains visible and
interactive on the left. No full-page navigation. The user can dismiss the panel
and continue browsing without losing their timeline position.

**Panel contents (top to bottom):**

1. **Header block**
   - Large cover art
   - Title (prominent)
   - Artist name
   - Year · Label · Catalog number
   - Primary style

2. **Apple Music CTA** (if `apple_album_id` is populated) — optional, see §4
   - Link out to Apple Music album page
   - Label: "Listen on Apple Music"

3. **Description** (if `album.description` is populated)
   - Editorial prose note. Visually labeled "Editorial note" to distinguish from
     sourced facts.

4. **Recording info**
   - Recording dates (`recording_dates_text`)
   - Studio name(s) (from session → studio join)

5. **Full tracklist with per-track personnel**
   - Each track: track number, title, duration (if available)
   - Under each track: the musicians on that track, with instrument and epistemic
     label
   - Epistemic labels rendered visually (see §3)
   - Musicians are **clickable** → triggers Personnel Network (§5.3) scoped to
     that musician

6. **Full album personnel** (collapsed by default; expand to see all performers)
   - All performers across all tracks, de-duplicated
   - Each row: musician name + instrument(s) + epistemic label
   - Musicians are clickable → triggers Personnel Network

---

### 5.3 Personnel Network Panel

**Triggered by:** clicking a musician name in the Deep Dive panel.
**Behavior:** opens as a panel or overlay alongside or replacing the Deep Dive.
The timeline does not need to remain visible while the network is open, but the
user should be able to return to the timeline easily (back/dismiss).

**The graph:**

A node-link graph. Two node types:

- **Album nodes** (larger): the albums in the canon that this musician played on
- **Musician nodes** (smaller): the other musicians who share at least one of
  those albums

Edges: musician → album ("played on")

**Default state (scoped):**
On open, the graph is scoped to the **clicked musician**. This musician is the
center node. Their albums radiate outward. The musicians who shared those albums
appear as secondary nodes. This is a star or near-star topology — legible, not a
hairball.

**Interaction from the scoped graph:**
- Click an album node → opens that album's Deep Dive panel (§5.2). Allows
  navigation through the network into another album.
- Click a secondary musician node → re-centers the network on that musician. The
  graph re-scopes. This is the core "follow the thread" interaction — how you
  find the Paul Chambers nugget.

**Visual encoding:**
- Node size proportional to number of shared albums (more collaborations =
  larger node)
- Edge weight (thickness) proportional to shared-album count between two
  musicians
- Instrument shown on hover/tap for musician nodes
- Epistemic encoding on edges is a nice-to-have, not required (the reference
  build deferred it too)

**The network is not a full-graph view.** It is always scoped to a selection. A
"show full network" mode is out of scope (see §8).

A graph-layout algorithm/library of your choice is fine — a force-directed
layout is a strong natural fit for this kind of data, but you are not required
to use any specific library.

---

## 6. Database Access

You are given **direct, full access to the real, already-curated dataset** — no
DB credentials required, no live connection needed:

- `db/schema.sql` — full DDL for the `_jazzcanon` schema (tables, views, types,
  constraints) as it exists in production.
- `db/data.sql` — a complete data dump of that schema, current as of 2026-07-01.

Restore both into a local Postgres instance (`psql your_db < db/schema.sql` then
`< db/data.sql`, or equivalent for whatever database you choose to use — you are
not required to use Postgres). From there, the data-serving architecture
(live queries, a build-time static export, GraphQL, whatever fits your stack) is
entirely your design decision.

---

## 7. Open Decisions

The following are explicitly left open. Propose a choice for each, with
rationale, before or at the start of implementation.

| Decision | Notes |
|----------|-------|
| **Database** | Postgres is what the dump targets; you may migrate the schema to another engine if you have a good reason. |
| **Data-serving model** | Live queries, build-time static export, or something else. Either is acceptable. |
| **JavaScript framework** | Your choice. |
| **Graph rendering approach** | A force-directed graph library is a strong fit for §5.3, but not mandated. |
| **Hosting** | Your choice — doesn't need to match any particular platform. |

---

## 8. Out of Scope

- User accounts, logins, or personalization
- Search box or free-text query (the timeline IS the navigation)
- Comparison Matrix
- Venue Map
- Instrument filter facet
- Sideman search
- Influence Tree
- Transcriptions or "learn the music" features
- Contemporary jazz or anything post-Fusion
- Concert listings, upcoming events
- Full-network ("show everything") graph view
- Admin interface

---

## 9. Reference

**Database dump:** `db/schema.sql` + `db/data.sql` (see §6)
**Brand / visual identity:** `style-guide.md` + `brand/` (logo mark, favicon,
lockups) — treat these as a fixed constraint, not a starting point to redesign.
**Genre definitions / scope rules:** `docs/genre-definitions.md`
**How to use this packet:** `README.md`

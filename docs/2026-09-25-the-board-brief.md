# The Board — staged feature brief

## Status

John described this future page on 2026-09-25 to stage it and identify useful
preparation during the current timeline/album-credit work. This is not a
commission to build or deploy the page now. No placeholder page, navigation
link, inert controls, or speculative graph refactor is needed in today's release.

## User intent

A new page named **The Board**, using the established Artist constellation
look and feel to explore producers and engineers and their album relationships.
Selected producer/engineer name appears at the upper left of the constellation
window, with explicit role context.

Selection model: one Engineer, one Producer, and one optional Musician.
Start from an engineer or producer; add the opposite production role and/or
one musician in either order. Filled additions can be removed/replaced
independently without changing the initial anchor. This slot interpretation
follows John's description; multiple same-role selections are not in scope.

Example (interaction only, not a verified credit claim): start with Tom Dowd
as Engineer; add a Producer then a Musician, or the Musician then Producer.
Both orders must give the same album set for the same final selections.

Reuse constellation vocabulary: album artwork nodes, person nodes, links,
zoom/pan, recentering, album opening, window appearance, and Back/Close behavior.
Keep the Board's production-focused default graph simpler than showing every
musician on every album. The precise page-level entry/search layout remains
for the Board build; do not invent a site-wide constellation redesign now.

## Relationship semantics — recommended

- Match albums carrying EVERY selected person in their selected role.
- Producer and engineer edges come from production credits; musician edges
  come from the existing performance graph.
- Same album is not proof of the same session, track, or direct collaboration.
  Explain this as shared album credits, consistent with the Artist constellation.
- Suggestions are role-specific and show shared-album counts after current
  selections. Count unique albums, not credit/session rows.
- Missing data means no recorded match, not proof that people never worked
  together. Show an honest empty state rather than silently dropping a selection.
- A person's role belongs to a credit edge, not their identity. Someone who
  produces, engineers, and plays retains one canonical person ID. Role-specific
  slots must not collapse into a single untyped person-ID list.
- Proposed dual-role behavior: permit the same canonical person in distinct
  role slots only when role-specific credits support the resulting intersection;
  render one identity with both roles rather than inventing duplicate people.
- Preserve epistemic labels; an inferred credit must not become a visually
  unqualified fact just because it appears in a graph.

## Useful preparation during today's work

1. Agree an additive structured production-credit export with mccoy. Retain
   album ID (or album-keyed parent), canonical person ID, display name, explicit
   role, epistemic label, and session scope when available/material.
   Do not flatten credits into comma-separated producer/engineer strings.
2. Use that same source for today's Full album personnel credits and future
   Board queries. Keep original credit rows/scope while deriving deduplicated
   display names or album membership separately.
3. Keep production roles separate from instrument entries in graph.json.
   Do not fabricate an instrument named Producer or Engineer or inject them
   into the existing musician graph.
4. Stable IDs permit joining production credits to existing musician IDs and
   album IDs. No name-based joins or second person-ID namespace.
5. Today, render credit names as text. When The Board works, connect these
   names to its role-aware constellation through a real navigation callback.
   Do not ship dead links or route them into an empty musician constellation.
6. Do not add a new export file unless its need is demonstrated. An additive
   credit field in the existing details export may be enough initially;
   size/loading needs and checksum-contract consequences must be assessed
   before choosing a dedicated graph export.

## Verified code/data seams

- `app/src/lib/DeepDive.svelte:231-251`: shared Full album personnel section.
- `app/src/lib/types.ts:45-52`: current AlbumDetail lacks production credits.
- `app/src/lib/group-query.ts:3-6,44-89`: existing all-selected-musicians
  same-album intersection. Reuse its semantics, not its untyped ID selection.
- `app/src/lib/Network.svelte:19-35,96-103,143-145`: musician-specific props,
  suggestions, and graph loading. The renderer is not already role-generic;
  extract a shared visual surface only when implementing and testing The Board.
- `app/src/lib/nav.svelte.ts:20-36`: musician navigation/group edits. Future
  Board entries need role-aware selection and independent Back behavior;
  preserve existing musician groups and their five-person limit.
- `app/src/App.svelte:18-46,112-138`: current pages and titles; no Board route.
- `/home/john/dev/active/mccoy-tyner/docs/schema.md:235-245`: documented
  production_credit uses canonical person IDs, role, epistemic, and optional
  session ID. Documentation is not proof of current credit coverage.
- Current site exports have no production-credit fields. mccoy consultation
  previously timed out; public contract and coverage remain unresolved.
- No references to The Board were found in the current site's searched
  Markdown/TypeScript/Svelte files. Yesterday's on-screen references are not
  evidence that a page or implementation already exists.

## Later acceptance anchors

- Engineer-first and Producer-first entry, correct name/role at upper left.
- Add opposite role or Musician independently, in either order; replace/remove.
- Final result is selection-order independent and role-specific.
- Dual-role people, duplicate session credits, unknown/inferred credits,
  multiple people with identical names, and empty intersections are covered.
- Album detail opens and Back restores Board selections; page changes close
  windows consistently; existing Artist constellation remains unchanged.
- Visual, keyboard, touch, narrow-screen, and zoom/pan parity with the existing
  constellation. No false session-level relationship claims.

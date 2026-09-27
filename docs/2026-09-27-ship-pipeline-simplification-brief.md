# Brief: ship.sh owns recently-added.json and the checksum manifest

Date: 2026-09-27
Author: McCoy (data lane), at John's ruling 2026-09-27
Status: Approved by John — "Please arrange all of this"
Build lane: @coder (Hermes), jazz-canon + mccoy-tyner/scripts/ship.sh

## Problem

The ship pipeline is fully scripted except two manual hops, both of which
hurt on the 2026-09-27 ship:

1. `recently-added.json` — a one-entry-per-ship, fully determined edit
   (album IDs + ship date) that currently requires a cross-lane agent
   round-trip per ship. On 2026-09-27 this hop cost an hour and surfaced
   two unrelated infrastructure bugs.
2. `docs/last-ship-checksums.txt` — refreshed by hand after every ship.
   The path format (repo-root-relative `app/public/data/<file>`) is easy
   to get wrong by hand; automation exists for exactly this.

## Decision (John's ruling)

ship.sh generates both. No per-ship agent handoff for either file.

## Spec

### recently-added.json generation

- A script (suggest `mccoy-tyner/scripts/recently-added.py` or a step
  inside `ship.sh`) derives the ship batch from `_jazzcanon.edit_log`:
  albums whose `site_status` went `found|reviewed → approved` since the
  last ship, plus the ship date.
- It writes/updates `app/public/data/recently-added.json` in the
  jazz-canon repo, preserving the file's existing structure and ordering
  (most-recent-first; read the current file and mirror it exactly).
- The gallery still owns the file's FORMAT. If the on-disk shape no
  longer matches what the generator expects, the generator must FAIL
  LOUDLY (schema check) and leave the file untouched — never "fix" it.
  Fallback: manual lane handoff, as today.
- Validation gate: JSON must parse and every batch ID must be present
  before ship.sh proceeds to build.

### checksum manifest refresh

- After ship.sh copies the five exports into jazz-canon, it regenerates
  `docs/last-ship-checksums.txt` from the repo root with
  repo-root-relative paths:
  `sha256sum app/public/data/{albums,details,graph,places,people-activity}.json`
  then verifies with `sha256sum --check` (all five OK or abort).
- Replaces the current manual post-ship step documented in the
  canon-ship-operations skill ("Durable fix pending" note).

### Git behavior

- The generator commits ONLY `recently-added.json` and
  `last-ship-checksums.txt` (plus tracked data files ship.sh already
  handles). It must never stage unrelated dirty files — the jazz-canon
  tree routinely carries deliberately held changes.

## Acceptance tests

1. A dry-run ship on a batch of N albums produces a recently-added.json
   entry with exactly those N IDs and the ship date, validated.
2. `sha256sum --check docs/last-ship-checksums.txt` passes from the
   jazz-canon repo root immediately after ship.sh completes.
3. Tamper test: hand-edit recently-added.json into an unexpected shape;
   generator refuses and ship halts before build.
4. Unrelated dirty files in the jazz-canon tree remain uncommitted after
   a ship.

## Notes

- Canon rules unchanged: `include` and status transitions stay John's;
  this is pipeline mechanics only, downstream of the greenlight.
- mccoy-tyner repo: `scripts/ship.sh`, `scripts/publish.sh`,
  `scripts/export.sh`. Jazz-canon repo: `app/public/data/`,
  `docs/DEPLOY.md`, `docs/last-ship-checksums.txt`.
- After implementation, update `docs/DEPLOY.md` and ping McCoy to patch
  the canon-ship-operations skill (remove the manual steps).

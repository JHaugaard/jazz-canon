# Straight-through ship follow-through — implementation brief

**Date:** 2026-09-25 · **Author:** mccoy (contract owner) · **Implementer:** Coder (Hermes, @coder)
**Status:** Commissioned by John, 2026-09-25. Supersedes nothing in
`2026-08-22-straight-through-ship-follow-through-handoff.md`; this brief turns
that planning handoff into a buildable contract with today's decisions folded in.

## Decisions John made today

1. **Full contract, both repos.** The mccoy-tyner side (manifest-writing in the
   ship pipeline) was never implemented and is in scope. Coder implements both
   sides; mccoy specifies and verifies.
2. **Two-phase deploy, as specced in 08-22.** ship.sh deploys data; the
   follow-through deploys again via `scripts/deploy.sh` once recently-added.json
   lands. No pre-build hook, no cross-repo invocation. The About page lagging by
   minutes is accepted.
3. Coder is the first-line implementation agent for this work (standing ruling
   2026-09-24, confirmed 2026-09-25).

## Contract files (mccoy-tyner → jazz-canon)

All three live in the **jazz-canon** repo under `docs/`:

- `docs/.ship-in-progress` — transient flag, present from ship start until the
  verified data deploy AND the checksum refresh AND `last-ship.json` are done.
  Must not be committed (add to .gitignore if needed). Contents: ISO timestamp
  + pid, for debugging a wedged flag. Follow-through refuses to run while it
  exists; manual removal is the documented recovery after a crashed ship.
- `docs/last-ship.json` — written **only after** deploy verification (HTTP 200)
  and the approved→live flip, and **only when the flip count is non-empty**
  (a pure republish with no approved albums writes nothing and leaves any prior
  manifest intact). Schema:
  ```json
  {
    "ship_date": "YYYY-MM-DD (US EDT)",
    "batch_ids": ["album-id", "..."],
    "album_count": 248
  }
  ```
  `batch_ids` = the exact ids flipped approved→live (ship.sh already runs that
  UPDATE … RETURNING id — capture the ids, not just the count). `album_count` =
  albums in the export (= live canon count after the flip).
- `docs/last-ship-checksums.txt` — sha256 manifest over exactly the five
  canonical exports (`albums`, `details`, `graph`, `places`, `people-activity`
  under `app/public/data/`), refreshed by mccoy **after** preview enrichment
  (details.json changes during enrichment; checksums must cover the shipped
  bytes). New lane rule: mccoy writes this file but does **not** commit it in
  the jazz-canon repo — the follow-through validates and commits it. (mccoy's
  2026-09-25 manual commit of the manifest predates this rule.)

### ship.sh / publish.sh changes (mccoy-tyner)

- Create `.ship-in-progress` at ship start (before publish).
- Capture flipped ids from the existing flip SQL (`RETURNING id`).
- After HTTP-200 verification + flip + checksum refresh: write
  `last-ship.json`, then remove `.ship-in-progress` (in that order).
- On failure/abort: leave the flag in place. A wedged flag blocks the
  follow-through, which is the safe failure mode; document manual removal.

## Follow-through script (jazz-canon)

Add an agent-run script (e.g. `scripts/ship-follow-through.mjs` — name is the
implementer's choice). Not a cron job, no automatic trigger. Pre-authorized per
John's 2026-08-22 ruling: when invoked after a completed ship, it may validate,
update recently-added.json, commit the intended files, deploy, and verify
without further human checkpoints.

Required behavior (numbers mirror the 08-22 doc, extended):

1. Refuse to proceed if `docs/.ship-in-progress` exists.
2. Validate `docs/last-ship-checksums.txt` against the five files byte-for-byte.
   Mismatch stops the run; **never** refresh or edit exported data to pass.
3. Parse `docs/last-ship.json`; validate schema (date shape, non-empty id array,
   positive count).
4. Cross-check every `batch_ids` entry exists in local
   `app/public/data/albums.json`, and `album_count` equals that file's album
   count. Count alone is insufficient.
5. **Basemap coverage stop-check (new, from today's ship):** every pin in
   `app/public/data/places.json` must fall inside some region bbox in
   `app/public/map/basemap.json`. If any pin is uncovered, stop and report which
   places need region authoring in `scripts/build-basemap.mjs`. Read-only check
   — the script never authors regions itself.
6. Update `app/public/data/recently-added.json` idempotently: prepend only
   manifest ids not already present, `added` = `ship_date`, newest-first order
   preserved, existing entries retained. Full-batch-already-present is a
   reported no-op, not an error. Validate the JSON after writing.
7. Commit **only** the intended files: `recently-added.json`,
   `docs/last-ship.json`, `docs/last-ship-checksums.txt`. Never stage unrelated
   or protected changes (today's known-protected dirty files:
   `scripts/enrich-previews.mjs`, the 08-22 handoff doc edits).
8. Fast-forward `main`, then deploy from `main` only via the existing
   `scripts/deploy.sh` contract.
9. Independently verify production: every `batch_ids` entry in served
   `/data/albums.json`, and the served `/data/recently-added.json` carries the
   batch dated `ship_date`. Count alone is insufficient.
10. Record the outcome in `docs/session-context.md` and issue John exactly one
    end-of-pipeline report.

### Exclusions (carried from 08-22, still binding)

- No database work, no mccoy pipeline execution (never runs ship.sh/export.sh/
  publish.sh), no edits to the five canonical exports.
- No Cloudflare account/project/DNS or `wrangler.toml` changes.
- No remote push unless separately directed under the-super's push posture.
- No fully automatic trigger in this first implementation.

## Acceptance

- **Validate-only mode** (e.g. `--check`) running all stop-checks without
  writing or deploying.
- **Built-in no-op test:** running it against the completed 2026-09-25 ship
  (manifest ids already in recently-added.json) must report a clean no-op.
- A simulated next ship (staged manifest + flag files) exercises the full path
  in a scratch clone before any live run.
- mccoy verifies the implementation against this brief before the first real
  ship uses it.

## Provenance notes for the implementer

- mccoy-tyner ship pipeline: `scripts/ship.sh` (flip SQL at lines 51–62),
  `scripts/publish.sh`, `scripts/export.sh`. Repo root
  `/home/john/dev/active/mccoy-tyner`, branch `master`.
- Site repo: `/home/john/dev/active/jazz-canon`, branch `main`.
- Basemap region model: `scripts/build-basemap.mjs` (REGIONS array; the runtime
  picks the smallest covering bbox — the coverage check should mirror that).
- 2026-09-25 ship closeout in `docs/session-context.md` shows the manual recipe
  this automation replaces.

# Straight-through ship follow-through — Jazz Canon handoff

**Status:** Approved by John, 2026-08-22. Planning handoff only; implementation belongs to Claude Code.

**Audience:** Claude Code, Jazz Canon repository only.

## Objective

After John tells mccoy to ship, eliminate every further human approval
checkpoint through verified publication of the hand-maintained
`app/public/data/recently-added.json` update.

This repository's new follow-through must use mccoy's completed ship manifest
as its input. It must not read the database, run `ship.sh`, `export.sh`, or
`publish.sh`, or alter the five canonical export files.

## Companion contract expected from mccoy-tyner

Do not implement against invented paths or fields. Coordinate with the
companion Claude Code handoff in `mccoy-tyner`. The completed mccoy-side
contract is expected to provide, in this repository:

- `docs/.ship-in-progress`, present from ship start until the verified data
  deploy completes;
- `docs/last-ship.json`, written only after mccoy's deploy verification and
  status flip, with `ship_date` (EDT), `batch_ids`, and `album_count`;
- `docs/last-ship-checksums.txt`, refreshed for exactly the five canonical
  exports only after that verified ship.

The handoff must be atomic enough that a follow-through cannot mistake a
partial copy for a completed ship. Exact format and write ordering are a
cross-repo contract to settle before coding.

## Required Jazz Canon behavior

Add an agent-run, pre-authorized follow-through script in this repository.
It is not an unattended cron job in the first implementation.

1. Refuse to proceed if the in-progress flag exists.
2. Validate the exact five-file checksum manifest. A mismatch stops the run;
   it never refreshes or edits exported data to make the gate pass.
3. Parse the completed manifest and validate its schema.
4. Cross-check `batch_ids` against local `albums.json`; every id must exist,
   and `album_count` must equal the local export's album count.
5. Update `recently-added.json` idempotently: prepend only manifest ids not
   already present, retain existing entries, use `ship_date` as `added`, and
   preserve newest-first ordering. If the full batch is already present,
   report a no-op rather than duplicate it.
6. Commit only the intended follow-through files — at minimum
   `recently-added.json`, `docs/last-ship.json`, and
   `docs/last-ship-checksums.txt`; never stage protected unrelated changes.
7. Fast-forward `main`, then deploy from `main` only via the existing
   `scripts/deploy.sh` contract.
8. Independently verify production after deploy: the specified `batch_ids`
   must be in served `/data/albums.json`, and the recently-added endpoint must
   carry the expected dated entries. Count alone is insufficient.
9. Record outcome in `docs/session-context.md` and issue John exactly one
   end-of-pipeline report.

## Authorization and safety model

John's 2026-08-22 ruling: a `recently-added.json` update derived from mccoy's
ship manifest is pre-authorized ship follow-through. It needs no per-ship
preview nod. This removes a human gate, not automatic safety tripwires.

The in-progress flag, checksum manifest, manifest/export cross-check,
main-only deployment, and independent live verification are required stop
conditions. Any failure stops and reports; it does not seek to repair data.

## Exclusions

- No database work or mccoy pipeline work here.
- No changes to Cloudflare account/project/DNS state or `wrangler.toml`.
- No remote push unless separately directed under the-super's push posture.
- No fully automatic trigger in the first implementation.

# Deployment — Cloudflare Pages

Production: https://jazzcanon.com/
Cloudflare Pages project: `jazz-canon`
Static artifact: `app/dist/`

This repository has two deployment lanes. Do not combine them.

## Code lane — jazz-canon

Use this lane for site code, styling, routes, or approved copy when no export
has changed since the last data ship.

```bash
scripts/deploy.sh --dry-run
scripts/deploy.sh --expect "literal changed text" --probe-path /data/albums.json
```

Use `--probe-path /` for route copy bundled into the application JavaScript.
Use the exact runtime resource path for JSON/content changes.

`scripts/deploy.sh` is attended. It:

1. Requires the checksum manifest to name exactly the five canonical exports,
   then verifies every hash. Alternate manifests are dry-run-only test inputs.
2. Runs `npm --prefix app run check` and `npm --prefix app run build`.
3. Serves `app/dist`, prints `http://vps8-core:4173/`, and displays the exact
   dirty working tree included in the build.
4. Waits for John's explicit `go` after he reviews both preview and working
   tree. Silence is not assent.
5. Runs the lockfile-pinned local Wrangler from `app/`; it cannot download a
   surprise current release after approval.
6. Verifies the unique Pages deployment URL first, including all
   release-specific JavaScript and stylesheet asset filenames plus the caller's
   changed content. It then retries the custom domain until that same release
   asset set and content are live.

`--dry-run` proves the exact manifest, type checks, build, and preview without
deploying or asking for approval.

Run the real deploy from `main` only. Wrangler infers the branch from git
HEAD; any other branch produces a preview deployment that the custom domain
will never advance to, and step 6 will fail after the upload has already
happened. Merge the named branch to `main` (with John's nod) first.

A data mismatch means: stop. DM mccoy or ask John. Do not refresh the checksum
record and do not edit the export locally to make the gate pass.

## Data lane — mccoy

Any export regeneration or status transition belongs to mccoy. From the
mccoy-tyner workbench, mccoy runs its canonical `ship.sh --go` pipeline:
export, copy, enrich, basemap, build, preview, deploy, and approved-to-live
status flip.

jazz-canon never runs `ship.sh`, `export.sh`, or `publish.sh`. For mixed work,
mccoy completes the data ship first; jazz-canon may then run the attended code
lane.

## Data-file facts

Every site build carries the complete local snapshot in `app/public/data/`.
The checksum gate covers:

- `albums.json`
- `details.json`
- `graph.json`
- `places.json`
- `people-activity.json`

`places.json` and `people-activity.json` are git-tracked. The first three are
generated and ignored. `recently-added.json` is separately tracked and
hand-maintained until mccoy's durable ship manifest exists.

## Routing and configuration

The app uses hash routes: `#/`, `#/working`, and `#/about`. No `_redirects`
file is required for these routes. `app/wrangler.toml` is read-and-invoke-only
in the jazz-canon lane. Cloudflare project settings, DNS, custom-domain state,
and account-level anomalies go to the-super.

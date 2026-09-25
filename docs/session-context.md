# Jazz Canon session context

This tracked file is the handshake surface shared by the jazz-canon Hermes
profile and its authorized engineering collaborators. Coder (Hermes, @coder)
is the default implementation agent; Claude Code requires John's explicit,
task-specific exception. Read it at session start. At session end, record the
branch, live state, work still in flight, and exact next gate. Do not use the
gitignored `.claude/session-context.md` as shared truth.

## Current coordination — 2026-09-25

### 14-album ship — LIVE VERIFIED (mccoy, same day)

- Batch shipped and deployed straight through on John's word: 248 albums live
  (was 234), 0 approved remaining. Deployment https://11143b91.jazz-canon.pages.dev,
  production HTTP 200; ship.sh flipped all 14 approved→live with edit_log rows.
- Batch: Soulville, Ballad of the Fallen, Bird on 52nd St, Charlie Parker Story,
  Lyric Suite for Sextet, Conference of the Birds, The Chase!, Groovin' High,
  Extrapolation, Standards Vol. 1, Introducing Kenny Burrell, Playing, Offramp,
  Genius of Modern Music Vol. 1.
- Independent live verification: /data/albums.json = 248 with all 14 ids;
  /data/recently-added.json carries the 14 dated 2026-09-25 newest-first
  (site-lane commit `52fc16d`); /data/places.json = 63; /map/basemap.json
  serves 11 regions including new london + bregenz; Offramp detail shows
  productionCredits with epistemic labels and 7/7 Apple previews.
- Basemap: 7 new recording places, 2 outside every region. mccoy authored the
  london + bregenz regions with John's explicit authorization (site session
  jazz-canon-3c idle with messages queued) — commit `17b9c78`. Coverage/land/
  budget checks all pass (gzip 80 KB vs 250 KB).
- Checksum manifest refreshed for exactly the five canonical exports, all five
  sha256 --check OK — commit `b69836d`, which also commits the tracked
  places.json + people-activity.json updates.
- Still deliberately uncommitted (site lane's own holdings, untouched by the
  ship): `scripts/enrich-previews.mjs` (title-first matching + GB storefront
  fallback — this version ran in today's ship) and the 08-22 handoff doc edits.
- Follow-ups, none blocking: (1) Offramp engineer credit "Jan Erik Kongshaug
  and Gragg Lunsford" is one person row naming two people — data-lane
  cull-note item. (2) The 14 new albums have no embeddings/search_document
  yet (embed.py needs the postgres-OS-user path; not site-blocking).
  (3) The 08-22 follow-through script and docs/last-ship.json contract remain
  unimplemented — today ran on the manual recipe again.

### Release checkpoint — live verified; ready for mccoy's album work

- Approved expansion is implemented on main: 1945–1985, Bebop lane without
  a classification date cutoff, initial 1965 view and semantic resize anchor,
  Producer/Engineer rows, About copy, and Working/Where Follow dates.
- mccoy supplied credits-only enrichment; manifest commit `74b4df3` retains
  the existing 234 albums. The 14 incoming albums were tested through browser
  interception only, not shipped. The Board remains a staged brief with
  role-aware credit plumbing, not a placeholder route or navigation link.
- Verification: 14 unit tests pass; browser expansion, credit-case, Follow dates
  and input-priority checks pass. Incoming 248-album preview also passes.
  Final independent read-only review found no material blockers (reviewer did
  not rerun checks). Fresh deployment dry-run: checks, build, five-file manifest,
  preview all green. Physical touch hardware remains untested.
- Review fixes preserve semantic position on restacking, keep labels outside
  card metadata, and retain native gesture/focus priority. Short windows use
  one card row rather than clipping a forced second row.
- Release code: `8a521ed` on main. John completed the attended deployment,
  reported `LIVE VERIFIED`, and confirmed the live site in his browser.
  Coder independently fetched https://jazzcanon.com/ and verified both release
  assets match the local build: `index-BFVlHaVW.js`, `index-ZIutQ88g.css`.
  Live exports contain 234 albums and 407 production-credit rows.
- Next work belongs to mccoy's album/data lane, under John's next instructions.
  Site preparation is complete; no authorization to ship the incoming batch
  is implied by this closeout. The Board remains future work.
- Protected preview-enrichment script and pre-existing straight-through-ship
  handoff edits remain outside this release.

### Preparation record (historical; superseded by checkpoint above)

- John reset the site work: use this checkout directly on `main` for the
  upcoming basic changes through deployment. Checkout is now on `main` at
  `6a6a45c`; no candidate site code has been imported or deployed.
- Accepted preparation scope: expand the timeline back to 1945, add a Bebop
  genre era lane beginning in 1945, support exported Bebop album classification,
  and revise About to include Bebop and the expanded scope. Album classification
  and exports remain with mccoy/Jazz Canon, not local JSON edits.
- Preserved yesterday's clean linked worktree using `git worktree move` at
  `/home/john/dev/cruft/jazz-canon/jazz-canon-bebop-2026-09-25`, branch
  `bebop-gallery-main`, HEAD `07595ad`. Candidate implementation is `2386625`.
  Nothing was deleted or merged. Useful candidate pieces: Bebop tint/accent,
  style-code mapping, album badge, 1945 start, and About's inclusion of Bebop.
- Do not import the candidate's handoff claims as current state. John has now
  explicitly set the canvas to 1945–1985 and accepted an initial 1945–1955
  Bebop era band, with no year cutoff on Bebop classification. Initial album
  timeline view should center on 1965 rather than the old 1957 anchor.
- Current export inspection: 234 albums, years 1950–1976, no `bebop` primary
  style or secondary tag. All five canonical export checksums pass. No new
  album IDs or classifications may be fabricated for the site.
- Current scoped specification: `docs/2026-09-25-site-expansion-spec.md`.
  Includes production credits below Full album personnel (display accepted;
  mccoy export contract/coverage still needed), visual/density acceptance,
  and Follow dates scrolling for Working/Where (framing now accepted by John;
  not yet implemented). No site code has changed in this reset.
  Do not couple this narrow work to ship-automation implementation.
- Future page staged in `docs/2026-09-25-the-board-brief.md`: producer/engineer
  constellation with opposite-role and optional musician selection slots.
  Preserve structured role-aware credits in today's export contract work;
  do not implement the future page or ship placeholder navigation now.

- Engineering default: Coder (Hermes, @coder). Claude Code is an exception
  path only with John's explicit, task-specific authorization.
- The approved 2026-08-22 straight-through ship follow-through remains to be
  implemented. Its authoritative Jazz Canon handoff is
  `docs/2026-08-22-straight-through-ship-follow-through-handoff.md`; the
  companion mccoy contract must be available before implementation begins.
- Protected in-progress work in this checkout: `scripts/enrich-previews.mjs`
  originated on `preview-fallback-matching` and remains modified after the
  switch to `main`. It is outside the Bebop work and must not be staged,
  reverted, or deployed as part of it.

## Current state — 2026-08-21

- Branch: `profile/jazz-canon-build`.
- Build purpose: create the jazz-canon Hermes profile and its attended
  code-lane deployment runbook.
- Production last observed before this build: https://jazzcanon.com/.
- Protected pre-existing work: `app/public/data/places.json` and
  `app/public/data/people-activity.json` were already modified. This build
  does not revert, regenerate, stage, or resolve them.
- Other pre-existing untracked paths left outside this build: `.docs/` and
  `docs/2026-08-17-places-on-site-brief.md`.
- Deploy rule: code lane uses `scripts/deploy.sh`; data lane stays with
  mccoy's `ship.sh --go`.
- Credential milestone M3 is complete: the profile has exactly the three
  expected nonempty `.env` keys and a profile-local Nous grant. The live
  Tool Gateway probe, Kimi smoke test, identity probe, and all three boundary
  refusal probes pass.
- Build verification: exact-manifest mutants, `npm run check`, Vite build,
  lockfile-pinned Wrangler 4.125.0, dry-run preview, and profile audit all pass.
- Remaining build step: independent re-review, then commit only the intended
  deployment/profile-handshake files. No push or deploy is part of this build.

## 2026-08-21 — copy edits LIVE on jazzcanon.com

- About lede: "had not yet crossed into fusion" → "into fusion".
- About: Jon Milavec dedication added below the "Jazz on Record" tagline.
- Working intro: added "Hover on any dot for clickable album information."
- Working footnote: dropped the "sessions across albums carry no usable
  date" clause; undated-only musician count now spelled out in words
  (live data: 33 → "Thirty-three musicians appear only on undated sessions.").
- Deploy: John's in-session nod; committed on the branch, fast-forwarded
  main (65a21d5..1751040), ran scripts/deploy.sh from main. First attempt
  from the branch produced a preview-only deployment (branch alias) that
  could not advance the custom domain — main is the production branch.
- Live verified: bundle index-BB5S7NQt.js serves all four changes;
  checksum gate, svelte-check, and build all green.
- Note: git committer identity was auto-derived (john@srv1086450.hstgr.cloud);
  not changed here — git config is the-super's lane.
- Branch is merged to main; no remote push (push posture pending the-super).

## 2026-08-22 — recently-added follow-through LIVE (10 albums)

- mccoy's ship of 10 albums completed 2026-08-22 (169 live, verified from
  both seats; session timestamps straddled midnight but John's clock rules:
  ship, landing, and deploy all date 2026-08-22). The recently-added.json
  follow-through was held overnight for a nod.
- John ruled 2026-08-22: recently-added updates derived from mccoy's ship
  manifest are pre-authorized ship follow-through, no per-ship nod.
- Deployed under that ruling: 10 entries prepended (added 2026-08-22) plus
  mccoy's post-ship checksum manifest refresh; committed on the branch,
  fast-forwarded main (e8cf744..a83b698), deployed from main.
- Live verified independently: /data/recently-added.json serves 74 entries,
  all 10 new ids on top dated 2026-08-22. Gate was red 11:13–11:18 while the
  ship was underway (by design), green at deploy preflight and after.
- Protected pre-existing changes (places.json, people-activity.json,
  .docs/, places brief) remain unstaged per this file.

## 2026-08-22 — straight-through ship plan APPROVED

- John approved the joint jazz-canon/mccoy plan: his instruction to mccoy to
  ship is the only human authorization. There are no intervening approval
  checkpoints through verified site follow-through.
- Proposed mechanics (implementation pending an @coder handoff in both
  repos): ship.sh writes an in-progress flag, then only after verified ship
  writes a machine-readable last-ship manifest and checksum refresh; a
  jazz-canon follow-through script validates that handoff, updates
  recently-added.json, commits, deploys from main, verifies served batch ids,
  and sends John one final report.
- Automatic safety tripwires remain: in-progress flag, exact checksum gate,
  manifest/export cross-check, main-only deploy, and independent live
  verification. These stop bad state; they do not request another human nod.
- John confirmed the operative date for all landing, shipping, and deployment:
  2026-08-22.

## 2026-08-30 — Open Graph preview fix LIVE

- Branch: `main`; John explicitly authorized this narrow OG commit directly on
  main in the active session.
- Observed production state: `https://jazzcanon.com/` serves a title and
  description but no `og:*` or `twitter:*` metadata, and no social image is
  referenced by the page.
- Added a 1200×630 PNG social card at
  `app/public/brand/open-graph.png`, retained its SVG source alongside it, and
  added canonical, Open Graph, and X/Twitter card metadata in `app/index.html`.
- Verified locally: `npm run check` (0 errors, 0 warnings) and `npm run build`
  pass; the built HTML carries all metadata and the built PNG is 1200×630.
- No prepared raster social image was found in the repository or its history.
  Claude Code independently confirmed that result. Its small-caps concern was
  superseded by John's narrowly scoped all-caps exception for this social card
  in `docs/DECISIONS.md` D24.
- Protected pre-existing work remains untouched:
  `app/public/data/places.json`, `app/public/data/people-activity.json`, and
  `.docs/`.
- Committed as `4ba102d` (`Site: add Open Graph social card`). mccoy refreshed
  the exact five-file checksum manifest in `079aa14`; all five checks now pass.
- Deployed from `main` after John's active-session finalization authorization.
  Wrangler deployment: `https://8c624b37.jazz-canon.pages.dev`.
- Independently live-verified: the custom-domain HTML serves every canonical,
  Open Graph, and X/Twitter tag; `/brand/open-graph.png` returns HTTP 200 as a
  1200×630 `image/png` whose SHA-256 exactly matches the committed card.
- Protected pre-existing work remains unstaged: `places.json`,
  `people-activity.json`, and `.docs/`.

## 2026-09-06 — constellation groups LIVE; 193-album ship landed

- mccoy's 193-album ship (20 added 2026-09-02) and the 2026-09-06 recently-added
  update (5 albums) are on main and live; checksum manifest matches live for all
  five exports.
- Constellation groups (D25): "Add musician" chips, same-album matching, cap of
  4. Built on branch `constellation-group` by John's explicit one-off exception
  to main-only; merged to main (db5f038), pushed to GitHub, branch deleted.
- Deployed from main via `scripts/deploy.sh --expect "Add musician" --probe-path /`;
  LIVE VERIFIED, bundle index-B50Utbr4.js.
- Tidy: `.superpowers/sdd/` (Places build workspace), `screenshots-temp/`, and
  `.docs/deployment-log.json` moved to `~/dev/cruft/jazz-canon-site/2026-09-06-tidy/`.
  `.docs/` is now gitignored (session-end status file only).
- Branch: `main`, clean. Next gate: none pending. Deferred ideas listed in D25 /
  the vault paper (same-track matching, add-from-album-personnel, shareable URLs).

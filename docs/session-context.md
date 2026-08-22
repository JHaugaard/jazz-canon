# Jazz Canon session context

This tracked file is the handshake surface shared by the jazz-canon Hermes
profile and Claude Code. Read it at session start. At session end, record the
branch, live state, work still in flight, and exact next gate. Do not use the
gitignored `.claude/session-context.md` as shared truth.

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
  all 10 new ids on top dated 2026-08-22; checksum gate green throughout.
- Protected pre-existing changes (places.json, people-activity.json,
  .docs/, places brief) remain unstaged per this file.

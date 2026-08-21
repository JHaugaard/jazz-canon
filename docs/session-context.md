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

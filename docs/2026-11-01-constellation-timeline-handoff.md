# Handoff: Constellation timeline feature

Date: 2026-11-01
Status: groundwork only. The dimming work is shipped; the timeline feature has not been designed or implemented. John owns the feature verdict and every merge/deploy decision.

## Why this handoff exists

The timeline should build on the shipped dimming architecture rather than rediscover it. The relevant baseline is commit `14898ea` (`feat: dim crowded constellations adaptively`), merged to `main`, pushed to `github/main`, deployed to https://jazzcanon.com, and verified in the live browser.

The detailed dimming decisions and measurements are in `docs/2026-10-31-constellation-dimming-followup.md`.

## Shipped behavior to preserve

- The complete constellation is the default sky. Dimming reduces visual weight; it does not hide nodes or edges.
- Resting opacity adapts smoothly to graph density and relative zoom. Small graphs retain the richer appearance; large graphs become quieter without disappearing.
- Repeat collaborators remain prominent. Hover/tap focus restores the selected node, its directly connected albums or people, and its edges at full strength.
- Touch uses first tap to trace and second tap to navigate. Mouse click behavior, Back, + Add musician, drag, pinch/scroll zoom, Reset, unpin, and keyboard activation remain intact.
- Album labels use deterministic collision avoidance: focused labels first, then more shared players, earlier year, title, and ID. No album titles should print over one another at Reset.
- One-off musician names return on focus and zoom. Small graphs keep their names at Reset.
- Reset fitting includes album captions and visible person captions. The final simulation-end refit respects prior user adjustment.

## Code map

- `app/src/lib/Network.svelte`: graph construction, D3 force simulation, Svelte rendering, focus/touch behavior, zoom/fit logic, and opacity integration. D3 computes positions only; Svelte owns the DOM.
- `app/src/lib/constellation-fade.ts`: pure density/zoom opacity model. Size is `albums + collaborators / 4`; perceived size falls with `zoomRatio²`. All ranges and calibration constants are isolated here.
- `app/src/lib/constellation-labels.ts`: pure album-label geometry, priority, and collision planner.
- `app/src/lib/group-query.ts`: selected-musician album intersection and collaborator counts. Same album is not a claim about same-track co-presence.
- `app/src/lib/types.ts`: `GraphData` currently carries person names and person↔album edges. `AlbumCard` already carries `year`.
- Tests sit beside the two helpers as `constellation-fade.test.mjs` and `constellation-labels.test.mjs`.

## State and timing lessons

- `resetZoomK` must reset to 1 whenever a new musician/group graph starts loading. Otherwise fading and label visibility inherit the previous artist's zoom baseline. This was a real bug caught in final review and fixed before shipping.
- Zoom ratio means current zoom divided by the current graph's fitted Reset zoom, not an absolute zoom value.
- Fit against final settled positions as well as early calm positions, but never override a user adjustment.
- Hidden headless-browser tabs report `document.hidden`; D3 timing may be throttled there. For deterministic QA, click Reset before measuring fit, opacity, labels, or collisions.
- Keep the two helpers pure. Timeline filtering/window logic should likewise be extracted into a pure, tested module rather than buried in pointer handlers.

## Data starting point

An album-year timeline can use the existing `AlbumCard.year`; no export change is required for that granularity.

A recording-date or session-exact timeline is a different contract. `graph.json` does not currently carry session dates. Album-detail data has recording-date display information, but that does not make it a suitable graph-level timeline contract. Do not silently present album year as session-precise history; label the chosen granularity plainly.

## Design questions for the new session, not settled decisions

- Does the lens accumulate up to a year, show a moving window, or support both? [Moving window}]
- Is album-year sufficient for phase 1, with recording-session precision explicitly deferred? [Album Year]
- Does the full sky remain the default, with time as an optional lens? Recommendation: yes. [Yes]
- Do header counts show visible nodes, total nodes, or both? Recommendation: make the time-filtered subset explicit rather than letting the full-canon count mislead. [Recommendation accepted}]
- Should layout positions remain stable while time changes? Recommendation: preserve positions where possible so the display reveals change instead of merely reshuffling. [Yes]
- What happens to a focused musician or album that leaves the active time window? This needs an explicit rule. [Deferred for discussion]
- Is Play useful, or is direct slider control enough for phase 1? [Slider Control}]

## Decision locked by John (2026-11-02)

- Repeat/one-off status uses the visible time window (Option B): 2+ shared albums inside the active window means repeat; 1 means one-off. This answers “who played with whom during this period?” rather than preserving all-time prominence in every slice.
- The musician tooltip carries both counts: `N shared album(s) in <visible window> · M overall`. The window determines visual prominence; the overall relationship remains available on demand.
- At full range, visible-window and overall counts are identical, so the shipped full-constellation behavior remains unchanged. This is a presentation rule only; no canon facts change.

## Suggested phase-1 acceptance shape

These are starting checks for a future spec, not authorization to build:

- With the lens at the full range, the shipped dimming behavior is unchanged.
- Changing time updates albums, collaborators, edges, labels, counts, and fade density together; no stale labels or orphaned edges remain.
- Repeat/one-off status uses the visible-window count per John's ruling. Tooltips show both window and overall counts, and full-range behavior matches the shipped constellation exactly.
- Paul Chambers and Ron Carter remain usable at full range and in narrow windows. A small artist does not regress.
- Focus, touch navigation, Back, + Add musician, zoom, and Reset continue to work with time active.
- Album titles do not collide and captions do not clip at Reset in each tested window.
- Pure time-window tests cover empty windows, boundary years, single-album windows, full-range equivalence, and large synthetic graphs.

## Team shape that worked on dimming

McCoy coordinated, owned `Network.svelte` integration and browser QA, and handled data-lane checks. Coder built the pure label/fade helpers with tests and performed adversarial read-only reviews. Non-overlapping file ownership plus browser verification caught issues that green helper tests alone did not.

A similar split is reasonable for timeline: Coder owns a new pure time-window helper and tests; McCoy owns integration and browser QA; both preserve the shipped baseline until John rules.

## Repository and deployment cautions

- Production gallery: `/home/john/dev/stable/jazz-canon`.
- At this handoff, `main` has three pre-existing modified files that are unrelated to constellation work: `docs/2026-08-22-straight-through-ship-follow-through-handoff.md`, `docs/session-context.md`, and `scripts/enrich-previews.mjs`. Leave them untouched unless John rules otherwise.
- The full suite last ran 59/61. The two failures are static export-count assertions (315 vs 248 albums and 72 vs 63 places), unrelated to the constellation work. The 27 label/fade tests, type check, and production build pass.
- Run the new feature on a named branch with a preview. Do not commit, merge, push, or deploy without John's direct authorization in the acting session.
- The code-lane deploy recipe is `docs/DEPLOY.md`. The successful constellation deploy used the cred-vault path after the unauthenticated attempt failed; do not print or inspect vault-supplied secrets.

## Useful commands

From `/home/john/dev/stable/jazz-canon/app`:

    npm run check
    npm test
    npm run build
    npm run preview -- --host 0.0.0.0

Use the actual Network URL printed by Vite if the preview port moves.

# Constellation sliding-window phase 1 spec

Date: 2026-11-03
Branch: `sliding-window`
Status: implementation spec. Branch-only work; no commit, merge, push, or deploy is authorized by this document.

## Authority and decisions

John's rulings from the handoff and the 2026-11-03 design discussion are fixed:

- Phase 1 uses album year, not recording-session precision. The UI must say so plainly.
- The full constellation is the default; time is an optional lens.
- The lens is a moving window controlled directly by a slider, with no Play control.
- Repeat/one-off status uses shared albums inside the visible window. The musician tooltip shows both visible-window and overall counts.
- Visible counts must be explicit rather than letting full-constellation counts mislead.
- Positions remain stable while time changes.
- A hovered or touch-pinned node that leaves the window loses focus and its tooltip. Selected center musicians remain selected.
- The time lens survives following musicians, group edits, and Back. Its center year remains fixed while its adaptive width is recomputed for the new constellation.

John authorized defensible, reversible, documented implementation choices for this branch. The choices below are therefore branch decisions, not requests for further rulings.

## Branch choices

1. Use one canon-wide, data-driven year axis. Its bounds are the minimum and maximum `AlbumCard.year` in the loaded album export, never hardcoded editorial dates. This keeps the center year comparable when navigating between musicians. The alternative of per-artist bounds is rejected for phase 1 because the same slider position would mean different years after navigation.
2. Use a bounded adaptive window. The slider selects a center year; the helper chooses the widest centered window, from 1 through 10 inclusive calendar years, whose visible album count is at most 8. If even one year exceeds 8, keep the one-year window. All albums in a calendar year remain together. This contracts in dense periods and expands in sparse ones without pretending to session precision.
3. Show the exact inclusive start/end years and window width whenever the lens is active. Adaptation must be legible rather than mysterious.
4. Activating the lens starts at the current constellation's earliest shared album year, not at the canon-wide minimum. This avoids an initial empty window for musicians whose canon appearances begin later.
5. Compute the full group query and force layout once. Filter rendered albums, collaborators, and edges from that stable full-sky simulation. Do not rebuild or reseed forces on slider input.
6. Recompute visible shared counts and use them for node radius, edge width, repeat labels, resting fade, and Add musician suggestions. Keep each person's overall count for the tooltip. At full range the visible and overall maps are identical.
7. Refit the visible subset after activating, deactivating, or moving the lens. Node positions do not change; only the camera reframes them. Reset view always fits the currently visible subset.
8. Clear transient hover/tap focus on every deliberate window change. This is slightly stronger than the minimum ruling and prevents a tooltip or focus thread from surviving while its target is leaving the visible set.
9. Header counts show `visible of overall` only while the lens is active. Full-range header text remains the shipped text.
10. A window with no albums gets an honest empty state naming the active years. It never implies that the musician was inactive outside the canon.
11. Update visible shared counts synchronously with slider input; defer only the camera refit to `requestAnimationFrame`. Background tabs can throttle animation frames, but radii, edge widths, labels, and tooltips must never continue describing the prior window while the camera waits.

The fixed five-year alternative is rejected because the current gallery export puts 28 of Paul Chambers's 37 albums in 1957–1961 while Ron Carter has only 3 in 1971–1975. Independent start/end handles are rejected for the first build because they weaken the direct slide-and-watch interaction; they remain the fallback if adaptive movement proves confusing in browser QA.

## Implementation boundaries

- `app/src/lib/constellation-time.ts`: pure adaptive-window and graph-filter/count logic, with no DOM or fetch.
- `app/src/lib/constellation-time.test.mjs`: empty windows, inclusive boundaries, dense one-year overflow, sparse expansion, clamping, single-album input, full-range equivalence, group intersections, and large synthetic input.
- `app/src/lib/Network.svelte`: time controls, stable-layout filtering, counts, tooltip, focus clearing, Add musician suggestions, and browser-observable behavior.
- No export, database, production data, navigation-stack, or deployment changes.
- Leave the three unrelated modified files untouched. Do not include them in any feature diff.

## Acceptance and fallback tests

- Full Range preserves the shipped nodes, edges, positions, opacities, labels, counts, focus behavior, and tooltip text.
- Moving the slider changes only visibility and derived presentation values; surviving node coordinates remain unchanged.
- Dense Paul Chambers windows contract and sparse later Ron Carter windows expand. Exact active years and `visible of overall` counts agree with the data.
- No filtered album or collaborator leaves an orphan edge, stale caption, or stale tooltip.
- A repeat collaborator can become one-off in a narrow window; the tooltip reports the narrow and overall counts together.
- Focus, touch navigation, group editing, Back, zoom, Reset, and keyboard slider operation continue to work.
- Album captions do not collide and visible captions do not clip at Reset in each tested window.
- Helper tests cover the cases listed above; `npm run check` and `npm run build` pass; unrelated static-count failures remain classified as baseline.

## Verification on the branch

- `npm run check`: 0 errors, 0 warnings.
- `npm run build`: clean production build.
- Full suite: 73/75. The only failures are the pre-existing static export-count assertions (315 vs 248 albums and 72 vs 63 places), unrelated to this feature. The new helper contributes 14/14 passing tests.
- Browser QA used the production preview, with Reset clicked before geometry measurements and throttled animations completed before mobile measurements.
- Paul Chambers full range and restored full range: 37 albums, 123 collaborators, 312 edges; the full-range tooltip retains its shipped wording. Surviving album coordinates were unchanged when the lens activated.
- Paul Chambers adaptive examples: 1956 → 1956–1956 with 4 albums; 1957 → 1957–1957 with 8; 1962 → 1961–1964 with 7; 1967 → 1963–1972 with 3.
- The tooltip regression initially exposed stale all-time shared counts in a throttled background tab. After the synchronous-snapshot fix, Wynton Kelly reads `1 shared album in 1963–1972 · 12 overall`; moving to 1956 clears the tooltip.
- Following Ron Carter at center 1967 preserves the center year and recomputes to 1967–1968 with 8 of 37 albums; Back restores Paul Chambers at 1967 and 1963–1972. Adding Miles Davis preserves the same center year and uses window-aware suggestions.
- Ron Carter sparse examples: 1971 → 1970–1973 with 7 albums; 1975 → 1971–1980 with 3. Johnny Hartman shows an honest empty state at the preserved 1975 center, then 1 of 1 album and 4 of 4 collaborators at 1963.
- Native ArrowRight slider input, first-tap trace/second-tap navigation, group editing, and Full range restoration passed. Tested Paul/Ron Reset views had zero album-caption collisions and zero clipped visible captions. Fresh phone-width geometry fits the viewport after the window entrance animation completes.
- Independent read-only review found no release blocker and reproduced the reported adaptive windows from the real export. Its wording finding was accepted: an empty-window Add musician popover now says `No collaborators in <window>` rather than the misleading `No matches in the canon`. Its remaining notes are defensive or invisible-intermediate-state observations, not observed defects.

If adaptive width changes feel abrupt or unpredictable in actual browser use, retain the pure filtering/navigation work and replace only the width policy with explicit user-selected widths. Do not conceal the problem by adding session-date precision or rebuilding layouts per window.

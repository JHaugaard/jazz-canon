# Constellation dimming follow-up: density + zoom

Date: 2026-10-31
Status: `constellation-dimming` branch preview only. No commit, merge, or deploy.

## Decisions

- Preserve every node and edge. Reduce visual weight rather than hiding the long tail.
- Compute graph size as `albums + collaborators / 4`. At Reset, a smooth logistic curve moves opacities from the existing small-graph values toward nonzero quiet floors. The curve and all floors live in `app/src/lib/constellation-fade.ts` and can be adjusted or reverted without touching data or layout.
- Treat zoom as reducing perceived density by `zoomRatio²`. `zoomRatio` is measured against each graph's own fitted Reset zoom, not an absolute scale, and the saved baseline resets whenever a new musician/group graph begins loading. By about 3×, a crowded graph approaches the small-graph appearance.
- Keep repeat collaborators and focused threads prominent. Hover/tap focus overrides every resting fade.
- Restore one-off names at 2× relative zoom as well as at the existing absolute zoom threshold, so dense graphs and small graphs both behave sensibly.
- Fit both album and visible person captions at Reset. Refit once more when the force simulation ends, unless the user has already adjusted the view. This repairs the previously observed edge-caption clipping without changing the force layout.

These are reversible presentation decisions only: no canon data, export shape, graph topology, or deployment state changed.

## Verification

- `npm run check`: clean.
- `npm run build`: clean.
- Fade model: 12/12 tests pass. Label planner: 15/15 tests pass.
- Full suite: 59/61 pass. The two failures are the already-documented static export-count assertions (315 vs 248 albums; 72 vs 63 places), unrelated to this branch.
- Paul Chambers at Reset: one-off dots ≈ .20, one-off edges ≈ .030, center edges ≈ .203. At approximately 2.1× zoom: dots ≈ .325 and all 123 collaborator labels appear.
- Ron Carter at Reset: one-off dots ≈ .181, one-off edges ≈ .027, center edges ≈ .189. No clipped captions after the person-caption fit fix.
- McCoy Tyner: Johnny Hartman remains faded at rest but returns to full opacity, name, tooltip, album, and edge on hover.
- Johnny Hartman's one-album constellation retains the rich small-graph values (dots ≈ .358, one-off edges ≈ .056, center edges ≈ .318), with all four collaborator labels shown.
- Album-title collision checks remained empty in the browser on Paul Chambers and Ron Carter.

## Preview

From `/home/john/dev/stable/jazz-canon/app`:

    npm run build
    npm run preview -- --host 0.0.0.0

Use the Network URL printed by Vite. The current branch preview has been running at `http://100.118.195.63:4173/`.

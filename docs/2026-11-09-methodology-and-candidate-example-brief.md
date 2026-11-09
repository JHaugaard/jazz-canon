# Methodology and Candidate Example — feature brief (McCoy, 2026-11-09)

Audience: @coder (Hermes), for planning and implementation. Author: McCoy, after consultation with John and inspection of the live database, workshop export/ship scripts, and gallery source. John reviews the rendered branch before any merge or deployment.

## 1. Intent and audience

Add a public methodology note to jazzcanon.com, a readable worked example of one AI review ballot and its supporting research file, and automatic renewal of the note's three closing figures during the ordinary ship process.

The audience is the interested general reader, including someone who is not technical and may be skeptical of AI. The presentation must be plain, calm, and transparent. It should show the care and depth of the research without requiring an interest in AI, JSON, databases, or software development.

The central message is: AI assists with research and review; John listens and makes every final decision.

## 2. Decisions already made

**[ruled] Content sources.** Use these workshop files as the authoritative content inputs:

- `/home/john/dev/active/mccoy-tyner/research/web-assets/methodology/note-on-methodology.md`
- `/home/john/dev/active/mccoy-tyner/research/web-assets/methodology/steamin-candidate-dossier.json`

Do not rewrite the ballot or silently change dossier facts. The ballot's qualifications and the distinction between builder rationale and council assessment are part of the evidence.

**[ruled] Three information layers.**

1. The methodology page presents the note and a compact worked ballot.
2. A linked candidate-example page presents the complete dossier in readable sections.
3. The untouched JSON remains available as a download for readers who want every field.

**[ruled] Branch workflow.** Build in gallery branch `methodology-dossier-example`, inspect the result in a local browser preview, refine it, and only then ask John for a verdict. No merge or deployment without John's explicit word.

**[ruled] Statistics architecture.** Generate the figures inside the existing export/ship path. No live database connection, public statistics API, scheduler, or separate statistics deployment.

**[ruled] Human authority.** The worked example must say plainly that the AI ballot is advisory, not the curator's verdict. Do not infer or display a verdict that is absent from the dossier.

## 3. Working-tree inventory at brief time

Gallery: `/home/john/dev/stable/jazz-canon`, branch `main`. These pre-existing modified files are unrelated to this feature:

- `docs/2026-08-22-straight-through-ship-follow-through-handoff.md`
- `docs/session-context.md`
- `scripts/enrich-previews.mjs`

Preserve them. Do not revert, stage, or include them in a feature commit. Re-run `git status` before branch creation because this is only a snapshot.

The workshop also contains unrelated documentation edits. Any workshop export/ship change must be staged by explicit file path and must not sweep those edits into a commit.

## 4. Existing-code and pipeline map

Gallery:

- `app/src/App.svelte:20-28` defines top-level routes; `App.svelte:119-146` supplies navigation and route rendering.
- `app/src/lib/About.svelte:14-100` is the existing long-form reading page. Its `article` width and typography at `About.svelte:102-189` are the starting visual language for the new pages.
- `app/package.json:6-12` provides `test`, `dev`, `build`, `preview`, and `check`. There is no Markdown renderer in the dependency list.

Workshop:

- `scripts/export.sh:24-270` writes the five current JSON exports; `export.sh:272-390` validates them.
- `scripts/publish.sh:14-19` copies every export into the dated snapshot. Its comment correctly requires every exported file to be carried forward.
- `scripts/ship.sh:18-30` defines the five files covered by checksums and tracked ship outputs; `ship.sh:34-39` copies the five exports to the gallery; `ship.sh:60-70` regenerates and verifies their checksum manifest.
- `ship.sh:97-140` deploys and then flips the captured batch from `approved` to `live`.

This feature therefore has two bounded change sets: gallery presentation on its feature branch, and a small workshop export/ship extension. There is no database schema or database content change.

## 5. Gallery presentation

### 5.1 Methodology page

Implementation default: add a link from the About page to `#/methodology`; keep the existing masthead navigation unchanged. Add a second route for the worked example, such as `#/methodology/example`. These routes are reversible presentation choices, not new top-level sections.

Render the methodology note as semantic Svelte/HTML with the same comfortable reading measure and type treatment as About. Omit the authored hard-coded `Current state` figures and render that section from `methodology-stats.json` instead.

The worked-ballot excerpt belongs after the explanation of the review process, with a link to the complete candidate example. Show:

- Miles Davis — *Steamin' with the Miles Davis Quintet* (1961)
- `consensus_core`, `must_have`, and `high` confidence translated into readable labels
- two of two reviewers answered
- the full `case_for`, `case_against`, and `recommendation` text
- `disagreement: null` rendered as “No disagreement recorded,” not as proof that the reviewers agreed
- a visible caption: “This AI review ballot advises the curator; it is not the curator's verdict.”

### 5.2 Complete candidate example

Use progressive disclosure: ballot → evidence → sources → technical metadata → raw JSON. Native `<details>` elements are acceptable and keep the interaction keyboard-accessible without new dependencies.

Recommended section order:

1. **Candidate summary.** Artist, album, release year, Prestige, hard bop, and the two 1956 recording dates. Keep release year and recording dates visibly distinct.
2. **AI review ballot.** Full ballot, with model and preset metadata under “How this ballot was produced,” not in the primary reading flow.
3. **Builder's nomination.** The dossier's `rationale`, explicitly distinguished from the reviewers' ballot.
4. **Recording and personnel.** Two session rows for 1956-05-11 and 1956-10-26 at Van Gelder Studio, Hackensack, followed by the five musicians and production credits.
5. **Tracks.** Six tracks with duration, recording date, and personnel variation. The compact display may say “Full quintet” or “Coltrane absent”; an expanded view must retain the complete per-track personnel lists.
6. **Sources.** Render S1–S7 as linked references and preserve the tokens used elsewhere in the dossier.
7. **Technical details and notes.** Identifiers, cover-art provenance, name variants, evidence labels, and research notes.
8. **Raw dossier.** Link the copied, byte-for-byte JSON as a download.

Use “Observed,” “Inferred,” and “Uncertain” in the reader-facing text, with `obs`, `inf`, and `unk` available where the code itself is useful. Do not present the AllMusic or guide ratings mediated through Wikipedia as direct consultation of those guides; the ballot's own qualification must remain visible.

Do not make cover art a feature of this page. The dossier marks the artwork inference and the unverified original-sleeve question; that belongs in the technical notes, not in a confident visual claim.

### 5.3 Implementation approach and rejected alternatives

Recommended: small Svelte route components that load the static dossier JSON and render its fields. This avoids duplicating the dossier content in HTML and leaves the raw JSON available for verification. The fixed methodology prose can be semantic Svelte/HTML.

Two alternatives considered and rejected for v1:

- **One long page containing everything.** Rejected because it hides the ballot-to-evidence hierarchy and makes the methodology note difficult for a general reader to finish.
- **A runtime Markdown-rendering dependency.** Rejected because one fixed document does not justify a new parser/sanitization and styling path. If the site later gains a library of documents, build-time Markdown rendering can be reconsidered.

## 6. Automatic statistics during export and ship

Add a sixth canonical export: `methodology-stats.json`.

Required shape, illustrated with the figures observed directly from the database on 2026-11-09:

```json
{
  "publishedAlbums": 325,
  "sources": 1382,
  "citations": 1619,
  "checkedOn": "2026-11-09"
}
```

`checkedOn` is the website publication date, not a claim of live database access. The reader-facing wording should be: “Figures from the database at the [date] website update.”

Database definitions:

- `publishedAlbums`: count of `_jazzcanon.album` where `canon_status='included'` and `site_status IN ('approved','live')`.
- `sources`: count of all rows in `_jazzcanon.source`.
- `citations`: count of all rows in `_jazzcanon.citation`.

The first definition deliberately matches the existing export gate. It counts the batch being shipped before deployment; after `ship.sh` flips that batch to `live`, the number remains correct. Querying only `live` during export would leave the displayed count one batch behind.

Workshop changes required:

1. Generate and validate the new file in `scripts/export.sh`. Require non-negative integer counts, a `YYYY-MM-DD` date, and `publishedAlbums == albums.json.length`.
2. Add the file to the snapshot loop in `scripts/publish.sh`.
3. Add it to the copy loop and `DATA_FILES` in `scripts/ship.sh`; update the file-count messages and checksum manifest from five to six.
4. Fail before deployment if the file is missing or invalid. Never silently retain hard-coded or stale figures.

Gallery changes required:

- Read `/data/methodology-stats.json` for the `Current state` section.
- If the static file cannot be loaded in the browser, show “Figures currently unavailable” or omit that section. Do not fall back to numbers embedded in the component.
- Make no runtime database or external API request.

Do not run `publish.sh`, `ship.sh`, or any deployment as a feature test. Those paths commit data or deploy. Test the export and checksum changes in a bounded, non-deploying way and reserve the full ship for John's explicit command.

## 7. Non-goals

- No live statistics service, cron job, or scheduled deployment.
- No new database rows, schema migration, canon-status change, or dossier fact correction.
- No generalized dossier library or candidate browser.
- No AI branding, chatbot, animation, or visual novelty for its own sake.
- No new top-level navigation requirement.
- No automatic merge, push, or deployment after browser review.

## 8. Verification and acceptance

### Data and ship contract

- Compare exported figures with direct read-only PostgreSQL counts.
- Assert `publishedAlbums` equals the number of entries in `albums.json`, including an approved-not-yet-live batch when one exists.
- Confirm the dated snapshot contains the new file.
- Confirm the gallery receives the new file and `docs/last-ship-checksums.txt` contains six valid entries; `sha256sum --check` passes.
- Confirm invalid or missing statistics stop the process before deployment.

### Gallery

Run `npm test`, `npm run check`, and `npm run build`. Report any unrelated baseline failure separately rather than claiming it as a feature regression.

In the real browser preview:

- The About link opens the methodology route; the example link opens the candidate route.
- The methodology note is readable without horizontal scrolling on desktop and iPad-sized viewports.
- The rendered figures exactly match the static JSON, and the authored page contains no duplicate hard-coded figures.
- The ballot displays both cases and the recommendation verbatim, with the advisory caption visible.
- The complete example shows two sessions, five musicians, six tracks, and S1–S7.
- Tracks 3 and 6 show Coltrane absent; the other four show the full quintet.
- Disclosure sections work by keyboard and the raw JSON link returns the unchanged dossier.
- A simulated statistics fetch failure produces the honest unavailable state.
- Browser network inspection shows only static asset requests for these pages, never PostgreSQL or a live statistics API.

The branch is ready for John's visual review only after these checks pass. Merge and deployment remain separate, explicitly authorized steps.

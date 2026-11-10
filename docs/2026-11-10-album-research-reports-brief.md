# Banked proposal: Album research reports

- **Date:** 2026-11-10
- **Status:** Banked for John's later review; not accepted, scheduled, or authorized for implementation
- **Priority:** Behind the Explainer Page, which John has designated as the next important site addition
- **Origin:** The public Steamin' candidate report linked from the methodology note
- **Decision owner:** John

## 1. Proposal

Give every published album a readable research page built from the database and presented through one reusable site template.

The recommendation is **yes to a rich album research page for every album**, but **no to requiring an identical AI candidate report for every album**. The common framework should be consistent; its depth should reflect the evidence and research that actually exist.

This document banks the idea for later discussion. It does not authorize a build, export change, data backfill, or deployment.

## 2. What the Steamin' example does today

The methodology example is neither hand-written HTML nor a live CMS page.

- `app/src/lib/CandidateExample.svelte` provides the HTML presentation.
- `app/public/methodology/steamin-candidate-report.json` provides the content.
- The browser fetches that static JSON file; it does not contact Postgres.
- The route, JSON filename, download link, and a few labels such as "Full quintet" and "seven references" remain specific to the example.

The presentation is therefore substantially reusable, but the current implementation is intentionally a one-album example rather than a general album-report system.

## 3. Recommended product distinction

Use two related but distinct concepts:

- **Candidate report:** Documents the research and AI review produced while an album was being considered. The Steamin' report remains the methodology example.
- **Album research report:** A public, database-backed account of an album already in the canon: why it was included, its sessions, musicians, tracks, production, evidence, and sources.

An album research report may include the historical AI review when that material exists, clearly labeled as an artifact from candidacy. It must not imply that an included album is still awaiting a decision.

The primary purpose is to document the album, not to publish AI prose for its own sake.

## 4. Observed data coverage

Read-only checks against the current database and research files on 2026-11-10 found:

| Material | Current coverage |
|---|---:|
| Published albums | 335 |
| Published albums with sessions, tracks, and personnel | 335 |
| Published albums with an inclusion rationale | 334 |
| Published albums with both AI review `case_for` and `case_against` prose | 232 |
| Published albums with at least one linked citation | 287 |
| Tracks with composer information | 2,285 of 2,346 |
| Published albums with archived/inbox candidate JSON | 235 |
| Published albums whose archived JSON contains the full set of fields used by the Steamin' example | 229 |

Consequences:

- A common factual report framework can cover every published album.
- The exact Steamin'-style candidate report cannot cover every album without additional research and writing.
- Missing sections must remain honestly absent or explicitly unknown. Uniformity is not a reason to manufacture content.

## 5. What exists for the original 100 albums

The original 100 were ingested together on 2026-06-25 from `data/canon-draft.json`, using the earlier two-harness selection process rather than the later candidate-report/AI-review pipeline.

Observed for all 100:

- All 100 remain published.
- All 100 have an inclusion rationale in Postgres.
- All 100 have album-level citations in Postgres.
- All 100 have sessions, tracks, and personnel.
- None has `case_for` or `case_against` prose from the later AI review process.
- None has a separate file in `research/candidates-archive/` or `research/candidates-inbox/`.

The original research is not absent. `data/canon-draft.json` contains rich nested personnel records and source references for the original albums. Its source legends were reconciled into the database's global source registry and album-level citations during the 2026-07-15 backfill.

**Answer:** A factual album research report broadly like the Steamin' page is feasible for each of the original 100. A Steamin'-style candidate ballot is not already available for those albums and should not be retrospectively invented merely to make the pages uniform.

## 6. Proposed page content

### Common sections when data exists

- Album title, artist, year, label, and style
- Curator's inclusion rationale
- Recording dates and locations
- Musicians and instruments, including track-level coverage
- Track titles, composers, durations, dates, and evidence labels
- Producer and engineer credits
- Sources and citations
- Cover-art provenance
- Technical identifiers and research notes where useful to readers

### Conditional sections

- Historical AI review case for and against inclusion, only when present
- Full candidate ballot metadata, only where the complete artifact exists and John wants it public
- Raw JSON download, subject to a later product decision

### Missing material

- Omit a section when it has no meaningful content.
- Use "Unknown" where the field matters but the evidence is absent.
- Do not infer composers, sources, review prose, or ballot outcomes to fill space.
- Do not make a missing AI review read like missing musical evidence.

## 7. How it should fit into the site

### Recommendation: album-card links first

The primary entry should be a link from each existing album card, provisionally labeled **Research & sources**.

Reasons:

- The report is contextual to one album; the card is where reader interest already exists.
- This adds depth without creating another top-level navigation destination.
- It avoids duplicating the site's existing album browsing and search interfaces.
- It keeps the first prototype small and reversible.

The album card's listening and exploration controls should remain primary. A quiet link after the album's factual content is preferable to crowding the top listening controls, though final placement belongs in the visual prototype.

### Route and return behavior

- Proposed route: `#/album/<album-id>/report`
- The report should link back to the album and preserve the reader's originating context where practical: timeline, constellation, search, or another entry point.
- Musician, place, and source links inside the report should use the site's existing exploration behavior rather than forming a separate navigation system.

### Optional later index

A separate **Album research** index could be added later if reading reports becomes a destination activity rather than only an extension of album exploration.

Possible index features:

- search by album or artist;
- filter by style, year, or report completeness;
- sort by artist, year, or recently added;
- direct links back to each album card.

The index is not required for the first version. Building it immediately would add a second browse interface before reader behavior demonstrates a need for it. No new top-navigation item is recommended for the initial prototype.

## 8. Publishing architecture

Recommended flow:

**Postgres → ship-time per-album JSON exports → one reusable report template**

Likely shape:

- one static report JSON per published album, under a path such as `/data/album-reports/<album-id>.json`;
- a parameterized report route that loads the requested album's file;
- the same `included` plus `approved`/`live` publication gate as the existing exports;
- structural validation and checksum coverage integrated into the export/ship contract;
- missing or malformed report files fail honestly without affecting the rest of the site.

This preserves the static-site architecture. It does not require a live CMS, browser database access, a scheduler, or a new public API.

Postgres remains the sole publication source of truth. Archived candidate JSON may be used for comparison or a separately authorized backfill, but should not become a parallel website data source.

## 9. Alternatives considered and rejected

### Publish archived candidate JSON directly

This would be faster for the albums that have archives, but it would omit approximately 100 published albums and diverge from Postgres after later corrections. The archive is research history, not the site's system of record.

### Generate missing ballots and reports retrospectively

This would create visual uniformity at the cost of historical and evidentiary honesty. It would manufacture review prose where no review occurred and add substantial research and maintenance work. Missing ballots are not a page defect.

### Require a separate report index at launch

This would add navigation and maintenance before demonstrating that readers need a standalone report-browsing destination. Revisit after the card-linked reports exist.

## 10. Pilot and acceptance test

When this proposal is revived, prototype three to five representative albums on a branch:

1. Steamin', representing a complete candidate research report.
2. A later album with database-backed AI review prose.
3. An original-100 album with rich factual research but no AI review.
4. If useful, an album with sparse citations or composer coverage to test honest absence.

Acceptance criteria:

- Report facts match Postgres.
- Only publication-gated albums receive public report files.
- Missing sections and unknown values are handled without fabricated content.
- Card-to-report and report-to-album navigation work at desktop and mobile widths.
- The original-100 page remains useful and attractive without an AI review section.
- Existing album cards and exploration routes remain unchanged in behavior apart from the added report link.
- Export validation and ship checksums cover the new files.

Fallback:

- If variable report depth proves distracting, publish the expanded treatment only above a John-approved completeness threshold and retain the current album card elsewhere.
- If the report duplicates too much of the card, reduce the report to rationale, sources, evidence, and research notes rather than forcing a full second album page.

## 11. Decisions deferred until revival

- Final public name: "Album research," "Research & sources," or another label.
- Exact placement and visual weight of the card link.
- Whether historical AI review prose appears on every album that has it or remains primarily a methodology illustration.
- Whether raw JSON downloads should be public for every album.
- How album-level versus track-level citations should be presented.
- Whether and when a separate research index is warranted.
- Whether any missing source or composer backfill deserves its own research task; none is a prerequisite for the honest first version.

## 12. Explicit non-goals for this banked proposal

- No implementation now.
- No competition with or delay to the Explainer Page.
- No retrospective AI ballots for the original 100.
- No requirement that every report have identical sections or length.
- No live CMS or browser access to Postgres.
- No canon-status or inclusion changes.
- No direct publication from research archives.
- No automatic deployment.

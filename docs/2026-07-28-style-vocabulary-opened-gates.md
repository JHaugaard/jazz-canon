# Handoff: Style vocabulary for the opened genre gates

**Date:** 2026-07-28
**From:** McCoy (Hermes session, with John)
**To:** Claude Code
**Lane:** schema-lane / vocabulary — **not** a schema migration (no ALTER TABLE, no new
columns). Rows + a script dictionary only.
**Priority:** before the first fusion / free-jazz / ECM candidate is staged. The three new
specialist agents are live and can run today; anything they produce will hit this gap.

## Background

On 2026-07-28 the genre gates opened: `excluded_styles` in `config/canon-rubric.md` is now
empty, and three specialist agents were installed at `~/.claude/agents/`:

- `jazz-fusion-researcher.md`
- `jazz-free-jazz-researcher.md`
- `jazz-ecm-researcher.md`

Design records live at `research/agent-briefs/{fusion,free-jazz,ecm}-brief.md`.

## The problem

`_jazzcanon.style` holds five codes — `cool-jazz`, `hard-bop`, `modal-jazz`, `post-bop`,
`soul-jazz` — and the `STYLES` dict in `scripts/stage-candidate.py` (line ~152) holds the
same five. `style_id()` returns `None` for anything else. The new agents are instructed to
emit style codes that do not exist yet, so their candidates will stage with
`style_primary_id = NULL` and their secondary tags silently dropped (`style_tags` loop at
scripts/stage-candidate.py:~630 skips unknown codes via the same lookup). No error is
raised — the data loss is silent.

## The work

**1. Extend the style vocabulary** with these codes (used by the new agents as
`style_primary` or `style_tags` — confirmed by reading all three agent files):

| code | display_name | used as |
|------|--------------|---------|
| `fusion` | Fusion | style_primary (fusion agent) |
| `jazz-rock` | Jazz-Rock | style_primary variant (fusion agent, source-driven) |
| `jazz-funk` | Jazz-Funk | style_primary (fusion agent) |
| `free-jazz` | Free Jazz | style_primary (free-jazz agent; also tag for ECM free edge) |
| `avant-garde-jazz` | Avant-Garde Jazz | style_primary for AACM-lineage records |
| `free-improvisation` | Free Improvisation | style_primary for the European wing |
| `european-jazz` | European Jazz | style_primary for ECM records whose centre is genuinely European |
| `ecm` | ECM | style_tag on every ECM-agent record (label-as-tag, never style_primary) |
| `spiritual-jazz` | Spiritual Jazz | style_tag (free-jazz agent) |
| `loft-jazz` | Loft Jazz | style_tag (free-jazz agent, loft era) |
| `aacm` | AACM | style_tag (free-jazz agent) |

Descriptions: match the terse house style of the existing five `STYLES` entries; the
handoff executor may draft them, John reviews on commit.

Two places, kept in lockstep:

a. `scripts/stage-candidate.py` — add the rows to the `STYLES` dict. The script already
   upserts `STYLES` into the style table on every run (`ON CONFLICT (code) DO NOTHING`,
   line ~463), so the script edit *is* the DB seed. No separate SQL migration needed.
b. Verify after the first staging run that `SELECT code FROM _jazzcanon.style ORDER BY
   code;` shows all 16 codes.

**2. `ecm` guard (small, same script).** `ecm` is a label tag and must never headline a
record. In `scripts/stage-candidate.py`, refuse (warn + treat as error) any candidate
whose `style_primary` is `ecm` — the fix is always "pick the real musical style, keep
`ecm` in `style_tags`." Also set the style row's description to note it:
"ECM Records label tag — never a primary style." (John, 2026-07-29: keeps the tag from
taking outsized emphasis.)

**3. JAPO ruling (agent-file edit, not DB).** John ruled 2026-07-28: **JAPO releases are
inside the ECM specialist's remit.** Edit `~/.claude/agents/jazz-ecm-researcher.md`: in the
"FUZZY — the sister labels" paragraph, JAPO moves from "name it in Gaps and ask" to IN —
an ECM subsidiary within the 1969–1979 window, catalogued like any ECM release, with the
label recorded as `JAPO` (not folded into `ECM`) so the imprint survives in the data. Also
update the matching line in `research/agent-briefs/ecm-brief.md` (boundary table row and
Open questions entry — the brief is the design record; keep it truthful).

**4. Explicitly out of scope** (do not do these):

- No new columns on `_jazzcanon.album`. `bridge_case`, `accessibility`, and
  `continuity_case` stay candidate-JSON-only for now; the briefs raise schema promotion as
  an open question, and John's call is to let the fields prove themselves over a few runs
  first.
- No changes to `check-candidate.py` (it enforces only the year window — style scope is
  prose-enforced, unchanged).
- No changes to the export/site pipeline; new style codes flow through the existing
  `style` table like the original five.

## Verification

1. Stage one synthetic candidate JSON with `style_primary: "fusion"` and
   `style_tags: ["jazz-funk"]` in a scratch DB transaction (or a dry run if the script
   supports it): confirm `style_primary_id` is non-NULL and both `album_style` rows land.
2. Confirm a record carrying an unknown *tag* still degrades gracefully (skipped, not
   fatal) — that behaviour should not change.
3. `grep -n 'fusion\|free-jazz\|ecm' scripts/stage-candidate.py` shows the new STYLES
   entries.

## Notes

- Writes go through `_jazzcanon_app` per `config/edit-contract.md`; the style upsert is
  vocabulary, not a fact edit, but the first staging run will exercise it.
- Existing 100+ staged albums are unaffected — no backfill.

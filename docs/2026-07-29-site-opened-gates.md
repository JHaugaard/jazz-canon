# Handoff: Site updates for the opened genre gates (jazz-canon repo)

**Date:** 2026-07-29
**From:** McCoy (Hermes session, with John)
**To:** Claude Code — **site lane, `~/dev/active/jazz-canon` repo only**
**Companion handoff:** `docs/handoffs/2026-07-28-style-vocabulary-opened-gates.md`
(mccoy-tyner repo — DB vocabulary + `stage-candidate.py` + agent-file edits). The two are
independent; this one does not depend on the other landing first.
**Decision record:** `docs/handoffs/2026-07-28-c1-swim-lanes-decision.md` (Option B2 + C,
DECIDED 2026-07-28, AMENDED 2026-07-29). Read it first — it is the why; this file is the what.
**Blocks:** deploying 12 approved albums (`included/approved`) to jazzcanon.com. McCoy
holds them until this lands and John approves the preview.

## Context in one paragraph

The canon gates opened 2026-07-28: fusion, free jazz, and the ECM label are admissible
through 1979. Twelve albums are staged and approved, awaiting deploy. The site's timeline
currently ends at 1972 with four overlapping era bands (Cool 1949–58, Hard Bop 1955–65,
Modal 1958–72, Post-Bop 1962–68). John's ruling (B2): **era bands stay eras** — free jazz
and fusion join them as bands because they are genres with era shapes; **ECM never gets a
band** because it is a label, not a genre (see
`mccoy-tyner/research/docs/ecm-genre-or-label.md`); opened-gate records also get a
card-level accent; and gate filter chips are in scope.

## The work

**1. Extend the timeline x-axis to 1979.** Currently ends at 1972. (Mechanical, but
everything else hangs on it.)

**2. Era bands — two changes in `app/src/lib/timeline-layout.ts` (`ERA_BANDS`):**

   a. Modal Jazz: `to: 1972 → 1979` (the modal tail is the canon's own continuity
      argument — Jarrett, Tyner's Milestone years).
   b. Add two bands:
      - `{ name: 'Free Jazz', from: 1959, to: 1979, cssVar: 'var(--era-freejazz)' }`
      - `{ name: 'Fusion',   from: 1968, to: 1979, cssVar: 'var(--era-fusion)' }`
   c. Add `--era-freejazz` and `--era-fusion` to the palette. Propose hues from the brand
      palette; John approves in preview.

**3. ACCEPTANCE GATE — six-band legibility prototype.** Before any of this ships, build
the six-band layout and check it visually. The `eraLane()` overlap math thins each band
as count grows; six overlapping translucent bands may turn to mush, especially the
1959–1979 Free Jazz band lying across Cool/Hard Bop/Modal/Post-Bop. **If illegible, fall
back to four bands (original Option B: gate records accented on cards only) and stop —
John re-reviews in preview before any further band work.** Do not ship a mushy canvas to
"see how it feels."

**4. Card-level gate accents.** Albums arriving through the opened gates get a visual
accent on their card (top-edge color or corner badge), driven by the record's
`styleCode` / style tags, which the data already carries:

   - `fusion`, `jazz-rock`, `jazz-funk` → fusion accent
   - `free-jazz`, `avant-garde-jazz`, `free-improvisation` → free-jazz accent
   - `ecm` tag present → ECM accent (distinct, quieter — it is a label tag, and its
     display weight should read *smaller* than a genre's, per John 2026-07-29)

   Accents are per-gate regardless of whether the six-band prototype survives (item 3).

**5. Gate filter chips.** A filter row (All / tradition / fusion / free jazz / ECM) that
dims non-matching cards. Independent of the band question; John wants the "show me the
free-jazz path" view for his study of the idiom.

**6. About page.** Add one sentence:
*"ECM appears in this canon's metadata as a label tag, not a genre; every ECM record here
earned its place on musical continuity, not imprint."*

**7. `styleCode` display check.** The 12 awaiting albums include style codes the site has
never rendered (e.g. post-bop variants already exist, but fusion/free-jazz/ECM-tagged
records are coming in the next drip cycles). Confirm style labels render gracefully for
all codes in the companion handoff's vocabulary table — no raw slugs, no blank chips.

## Explicitly out of scope

- No schema or DB work (companion handoff's lane).
- No changes to the export contract; the site consumes what `mccoy-tyner/scripts/export.sh`
  already emits. If a needed field (e.g. style tags for the accent) is missing from the
  export, STOP and tell McCoy — do not patch around it in the site repo.
- No deploy to production. Build + preview only; John runs the preview, then
  `mccoy-tyner/scripts/ship.sh` handles the real deploy in a separate session.

## Verification (before handing back to John)

1. Timeline spans to 1979; the 12 approved albums render in the correct years (spot-check:
   In a Silent Way 1969, The Prisoner 1969, Journey in Satchidananda 1970,
   Let My Children Hear Music 1972).
2. Six-band (or fallback four-band) layout screenshot for John's preview review.
3. Accent colors visible on at least one card per gate once gate albums exist in the
   export — for now, verify the accent mapping against a synthetic/test record if no
   gate record is in the data yet.
4. Filter chips dim correctly; "All" restores.
5. About page sentence present.

## Sequencing note

McCoy deploys only after: this handoff lands + companion vocabulary handoff lands +
John approves preview. Then the 12 approved albums ship in one deploy — the V1
culmination.

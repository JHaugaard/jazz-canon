# C1 Decision Memo — Swim Lanes as the Gates Open

**Date:** 2026-07-28
**For:** John — one design decision, then CC-Site executes in the jazz-canon repo
**Context:** the opened genre gates (fusion, free jazz, ECM — all ≤ 1979) will bring
records whose styles don't fit the site's current era-band model.

## What the site actually does today (obs, from the code)

The "swim lanes" are `ERA_BANDS` in `app/src/lib/timeline-layout.ts`: four overlapping
translucent bands behind the timeline cards —

| Band | Years | CSS var |
|------|-------|---------|
| Cool Jazz | 1949–1958 | `--era-cool` |
| Hard Bop | 1955–1965 | `--era-hardbop` |
| Modal Jazz | 1958–1972 | `--era-modal` |
| Post-Bop | 1962–1968 | `--era-postbop` |

Key facts that shape the options:

1. The bands are **eras, not genres** — overlapping year ranges with blended colors.
2. The timeline x-axis currently **ends at 1972**; it must extend to 1979 regardless of
   which option is chosen. That part is mechanical, no decision needed.
3. Bands overlap deliberately (`eraLane()` in timeline-layout.ts); the design tolerates
   4 overlapping bands but the math thins out fast as count grows.

## Why "just add more lanes" breaks

The three opened gates are not eras in the same sense:

- **Fusion 1968–1979** and **free jazz 1959–1979** overlap *each other* and the existing
  modal band almost completely — as translucent bands they'd stack into visual mush.
- **ECM is a label, not a genre or era** (per research/docs/ecm-genre-or-label.md). Giving
  it an era band would be the one indefensible claim we just documented against.
- 11 style codes ≠ 11 lanes; a lane per style was never the model anyway (soul jazz
  already has no band).

## The options

### Option A — Add three gate bands anyway (5→7 bands)
Extend ERA_BANDS with Fusion (1968–79), Free Jazz (1959–79), ECM (1969–79).
- *For:* conceptually uniform; every arrival visible in the same visual language.
- *Against:* three near-full-width bands overlapping the whole canvas — the overlap-blend
  design loses legibility; ECM-as-band contradicts the label-not-genre ruling; the bands
  stop meaning "era" and start meaning "tag," quietly changing what the visualization
  claims.
- *Verdict: not recommended.*

### Option B — Two tiers: eras stay eras; gates get accents (RECOMMENDED)
Keep the four tradition bands as they are (extend `--era-modal`'s `to` to 1979 — the modal
tail is the canon's own continuity argument). The timeline axis extends to 1979. Opened-gate
records are distinguished on the **card**, not the background: a colored top-edge or corner
badge per gate (fusion / free jazz / ECM), with the existing `styleCode` field driving it
(types.ts already carries `styleCode` on every card).
- *For:* the background keeps telling the truth (eras of the tradition); the gate records
  are visibly "arrivals through the new gates" without redefining the visual grammar;
  ECM appears as an accent — a tag, not a lane — which matches the genre-or-label ruling
  exactly; scales to 11 style codes without 11 bands; smallest change to layout math.
- *Against:* gate records aren't browsable "by lane" the way eras are; if John wants to
  *see the shape* of e.g. fusion across 1968–79, that's a filter, not a band — see Option C.
- *Effort:* small — one accent-color map, a card style tweak, axis extension.

### Option C — B plus a gate filter (lane on demand)
Option B, and add filter chips (All / tradition / fusion / free jazz / ECM) that dim
non-matching cards. Search.svelte already exists; this is a filter, not a redesign.
- *For:* gives John the "show me the free-jazz path" view the free-jazz agent's Listening
  Path concept wants — the study sequence made visible on the timeline; zero new bands.
- *Against:* more work than B; can be Phase 2.
- *Verdict: recommended as a follow-on, not required for shipping the archive backlog.*

## Recommendation

**Option B now, Option C when the free-jazz study material lands.** This keeps the site's
visual claim — "these are the eras of the post-bebop tradition" — intact, treats the opened
gates as what they are (deliberate, flagged arrivals), and never puts ECM on the canvas as
if it were a genre.

## Decision (John)

**DECIDED 2026-07-28: Option B + C** — era bands stay eras (modal extended to 1979),
opened-gate records get card-level accents, and the gate filter chips are in scope as a
follow-on in the same site pass. John approved in conversation.

**AMENDED 2026-07-29: Option B2 + C.** On reflection John ruled that free jazz and fusion
— being genres with genuine era shapes — belong IN the era-lane framework: add two bands,
Free Jazz (1959–1979) and Fusion (1968–1979), alongside the four tradition bands (six
total). ECM does NOT get a band — it is a label tag, per the genre-or-label ruling, and
appears only as a card-level accent. Gate accents on cards remain for all three gates.
Acceptance test: CC-Site prototypes the six-band layout and confirms legibility; if the
overlap-blend turns to mush, fall back to four bands (original B) and John re-reviews in
preview.

- [ ] Option A — more bands
- [x] **Option B + C — accents now, gate filter as follow-on (DECIDED)**

## Acceptance gate result (CC-Site, 2026-07-29)

**Six bands PASS — no fallback needed.** Prototyped and screenshotted at 1512×900, 1024×768
and 390×844 against the live 135-album export. At six bands `eraLane()` gives each lane
18.8% of the vertical space (down from 27.6% at four); the lanes still read as distinct
horizontal strips and the overlap blend stays legible, including the crowded 1962–1965
zone where five bands coexist and the 1968–1979 tail where Modal / Free Jazz / Fusion run
together. John reviews the screenshots in preview; if he disagrees, the fallback is
removing the two new entries from `ERA_BANDS` — the card accents are independent of the
band question and stay either way.

## If B/C chosen — CC-Site handoff items (jazz-canon repo)

1. Extend timeline x-axis to 1979.
2. `--era-modal` band `to: 1972 → 1979`.
3. Add gate-accent color map: `fusion`, `free-jazz`, `avant-garde-jazz`,
   `free-improvisation` → gate accent A/B; `ecm` tag → ECM accent. (Exact hues: CC-Site
   proposes from the brand palette, John approves in preview.)
4. Card treatment: top-edge accent or corner badge driven by `styleCode`/tags.
5. About page: one sentence — *"ECM appears in this canon's metadata as a label tag, not a
   genre; every ECM record here earned its place on musical continuity, not imprint."*
6. (Follow-on, Option C) gate filter chips dimming non-matching cards.
7. Nothing ships until this lands: the staged archive backlog publishes only after the
   new styles render correctly (McCoy holds `site_status` at `approved`).

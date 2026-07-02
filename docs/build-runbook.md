# Build Runbook — Jazz Canon Test (Fable 5, Single-Run Edition)

**Created:** 2026-07-01
**Revised:** 2026-07-01 — restructured for a clean, Fable-5-only benchmark run: one kickoff
prompt, one proposal gate, then hands-off. (Earlier drafts used an 8-phase gated structure
inherited from a different model harness.)
**Revised:** 2026-07-01 (later) — reconciled against `docs/prompting-claude-fable-5.md`
(Anthropic's published Fable 5 prompting guide): adopted the tested grounded-progress
wording, subagent delegation + verifier-subagent guidance, a communication addendum, and
a context-reassurance intervention row.

---

## The Shape of the Run

This is a **benchmark of Claude Fable 5's independent execution**, so the run is designed
for signal purity:

- **One model.** Fable 5 for the entire run. No switching, no mixture — a mixture would
  lower cost, not raise success probability, and it would muddy whose build this is.
- **One prompt.** Fable 5 performs best given the full task specification in a single
  well-specified turn; it is built for long-horizon autonomous work. Slicing the build
  into per-step prompts is the prior-model pattern and reduces output quality.
- **One gate.** After reading the packet, the model asks its questions and proposes its
  architecture; you approve or push back. That is the only planned human touchpoint.
  Everything after it is the model's run.
- **All content comes from the packet.** The kickoff prompt below deliberately contains
  no design guidance — no hints about the graph architecture, the epistemic treatment,
  the timeline layout, or the palette rules. Everything the model needs is in `BRIEF.md`,
  `style-guide.md`, and `db/`. What it surfaces, and what it misses, is the data.

---

## Pre-Flight Checklist

1. Fresh Claude Code session in the repo directory (`~/dev/active/jazz-canon-test-fable`).
   No prior conversation context — `/clear` if in doubt.
2. `/model claude-fable-5` — confirm before pasting.
3. Postgres 16+ available locally (the restore needs it; no extensions required).
4. Recommended: `git commit` the packet state first, so the run's diff against the packet
   is inspectable afterward.
5. Leave reasoning effort at Claude Code's default. Single turns on the hard parts
   (timeline layout, personnel graph) can run many minutes — that is normal Fable 5
   behavior; let them finish.

---

## The Kickoff Prompt

Paste verbatim. This is the entire assignment.

```
This repo is a benchmark packet for an app called The Jazz Canon. You are being evaluated on independent, end-to-end execution of the build.

Read the packet first:
- BRIEF.md — the assignment: what to build, scope, requirements. Binding.
- style-guide.md + brand/ — the locked visual identity. Fixed constraint, not a starting point.
- docs/genre-definitions.md — canon scope reasoning, for context.
- README.md — how to restore the database.
- db/ — the full, already-curated dataset (schema + complete data).

Your job: build the v1 app described in BRIEF.md from this packet alone. A reference implementation exists but is deliberately not included — I want your independent execution: propose your own stack, design the data-serving architecture, and design and build the UI/UX and the Personnel Network graph yourself.

Process:

1. PROPOSAL FIRST. After reading the packet, come back to me with: (a) any questions the packet doesn't answer, and (b) your proposed resolution of every open decision in BRIEF.md §7, with rationale — what you considered and rejected, and the main technical risks you foresee in your own proposal and how you'll handle them. Do not scaffold or write code yet. Record the proposal in docs/DECISIONS.md and keep that file updated whenever a decision is made or revised for the rest of the build.

2. AFTER MY GO-AHEAD, work autonomously to completion. Make the minor calls yourself and note them; come back to me only if genuinely blocked on something the packet and I haven't answered. Post a brief progress note as you complete each major piece. Delegate independent subtasks to subagents and keep working while they run; intervene if a subagent goes off track or is missing relevant context.

3. Restore the database per README.md and verify the restore against the expected counts (100 albums, 567 people, 666 tracks, 670 performances). If anything fails, report it with the output — don't work around it silently.

4. Build v1 scope only (BRIEF.md §4). Do not build v2/v3 features or anything in §8. Do the simplest thing that works well — no speculative abstractions, no features beyond the brief.

5. Verify as you go. Establish a method for checking your own work against BRIEF.md as you build, and run it at each major milestone — fresh-context verifier subagents checking against the spec tend to beat self-review. Before reporting progress, audit each claim against a tool result from this session: only report work you can point to evidence for; if something is not yet verified, say so explicitly. Report outcomes faithfully — if tests fail, say so with the output; if a step was skipped, say that; when something is done and verified, state it plainly without hedging. Before declaring the build done, walk the full discovery loop the brief describes (timeline → album → deep dive → musician → network → another album → another musician) in the running app and report the walk.

6. Finish with a production build, verified working when served locally: data present, cover art loading, Apple Music links functioning where populated. Prepare the deployment configuration for your proposed hosting, but do NOT deploy — present the config and the exact deploy command, then stop. Deployment is my call.

7. COMMUNICATION. Working shorthand between tool calls is fine — that's you thinking out loud. Milestone reports and your final summary are different: they're for a reader who didn't watch the run. Lead with the outcome, write complete sentences, spell out identifiers and terms you introduce, and drop any shorthand or labels invented mid-run.

Done means: the v1 app from BRIEF.md working end to end in a locally-served production build, docs/DECISIONS.md complete, and verification evidence shown — with deployment prepared but not executed.
```

---

## The Proposal Gate (your one touchpoint)

When the model returns with questions and its §7 proposal, assess before giving the
go-ahead:

- **Data-serving model.** Does it propose a static build-time export, or a live DB at
  runtime? For a read-only app, static export is the strong play. If it proposes live
  queries, is the justification real?
- **The DOM-ownership tension.** The prompt asks only for "main technical risks." A
  strong model independently surfaces the question of who owns the SVG DOM in the graph
  component — the framework's reactivity system or the graph library's selections — and
  proposes a boundary (framework owns the container/lifecycle; graph library owns the
  interior; reactivity bridges prop changes to the library's update methods). A model
  that just says "use D3" has not seen the deepest architectural tension in the brief.
  **Do not name this yourself before judging the answer.**
- **Graph layout.** Force-directed (or an equally defensible choice) for §5.3?
- **Cover art.** Does it notice the art is URL references in the DB, not local files,
  and address how images are served?
- **Questions asked.** Are its questions sharp (real gaps in the packet) or filler?

Push back where needed — pushback here is part of the protocol, not a deviation. Once
satisfied, confirm `docs/DECISIONS.md` reflects the settled choices and say **go**.

---

## Hands-Off Rules (after the gate)

From the go-ahead to the finish line, you are an observer.

- **Don't steer.** No hints, no course corrections, no "have you considered…". If the
  model asks a genuinely blocked question, answer the narrowest version of it.
- **Every intervention is a logged deviation.** If you must step in (see the intervention
  table below), write down what you said and when — the benchmark write-up needs it, and
  an intervened run scores differently on the affected signals.
- **Long silent turns are normal.** Fable 5 front-loads reasoning on hard tasks; a
  multi-minute turn on the timeline or the graph is expected. Interrupting one is a
  deviation.
- **Let its choices stand.** Language, framework, library picks within the brief's open
  decisions are its to make. Note them as data, not defects.

---

## Observer Scorecard

Score at the end of the run (or as the moments pass). Signals are marked **clean**
(nothing in the kickoff prompt points at them — surfacing is genuine insight) or
**packet-guided** (the requirement is stated in BRIEF.md / style-guide.md — the signal
is faithful compliance, which still separates builds).

| # | Signal | Type | What to look for |
|---|--------|------|------------------|
| 1 | Epistemic discipline | Clean | Does obs/inf/unk show up as a first-class concern in the proposal and early design, or do the labels get bolted on late? |
| 2 | DOM ownership | Clean | Surfaced unprompted at the proposal gate (or in the graph design), before implementation discovers the conflict? |
| 3 | Grounded completion claims | Clean | Are "done" reports backed by observed behavior in the running app and real query output, or asserted? Does it actually walk the discovery loop? |
| 4 | Sharpness of questions | Clean | Do its gate questions expose real packet gaps? |
| 5 | Scope discipline | Clean | v1 only — no v2/v3 features, no unrequested extras, no gold-plating. |
| 6 | Data integrity | Packet-guided | Restore verified against the counts; epistemic labels survive the export into the UI. |
| 7 | Era band overlaps | Packet-guided | Overlaps rendered as historically accurate, not resolved into discrete bands. |
| 8 | Progressive disclosure | Packet-guided | The timeline shows what is temporally nearby, not all 100 albums at once. |
| 9 | Star topology | Packet-guided | The graph opens scoped to one musician; re-centering works; not a hairball. |
| 10 | Editorial vs sourced | Packet-guided | Editorial content (Lora, amber, labeled) never looks like sourced fact. |
| 11 | No traffic lights, no red | Packet-guided | Epistemic states use the amber treatment; red appears nowhere. |
| 12 | Brand fidelity | Packet-guided | Palette hex values, Oswald 600 small-caps / Inter / Lora, era band tints match style-guide.md. |

---

## If You Must Intervene

Interventions rescue the build at the cost of the affected signal. Log each one.

| Symptom | Intervention | Signals affected |
|---------|--------------|------------------|
| Proposes live Postgres at runtime (at the gate) | Push back at the gate — this is the gate's job, not a deviation | — |
| Restore or export silently "worked around" | Ask for the actual error output and a real fix | 3, 6 |
| Graph is a hairball | Ask whether it's scoped to one musician on open; if it needs more, suggest an edge threshold (shared_albums ≥ 2) | 9 |
| Era bands made mutually exclusive | Point at BRIEF §5.1: overlaps are accurate and must stay visible | 7 |
| Traffic-light epistemic colors | Point at style-guide.md §2's anti-pattern paragraph | 11 |
| Timeline dumps all albums at once | Point at BRIEF §5.1 progressive disclosure | 8 |
| Claims done without walking the loop | Ask it to walk the loop per kickoff item 5 | 3 |
| Asks permission for minor choices mid-run | Remind it of kickoff item 2: minor calls are its to make | — |
| Suggests wrapping up or a new session "because of context" | Reassure verbatim: "You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits. Continue the work." | — (log it) |
| A turn refused (rare classifier false-positive) | Rephrase; if stuck, `/model claude-opus-4-8` for that single turn, then back — log it | run purity |
| Session dies mid-run | New session: paste the kickoff prompt again with one added line: "The run is already in progress — read docs/DECISIONS.md and the repo state, then continue from where it stopped." | — (log it) |

---

## Appendix — Checkpointed Fallback

If a fully autonomous run proves ungovernable (or you want more observation points on a
second run), split the same kickoff prompt at two natural seams instead of reverting to
fine-grained phases — keep each segment goal-shaped, not step-shaped:

1. **Checkpoint A — after the proposal gate** (already in the protocol).
2. **Checkpoint B — data + scaffold done:** append to kickoff item 2: *"Pause for my
   review once the database is restored, the export verified, and a minimal page renders
   real data — then continue on my go."*
3. **Checkpoint C — v1 features done, pre-ship:** append: *"Pause again when the three
   screens work end to end, before the production build."*

Three gates, same prompts otherwise. Anything finer-grained than this trades away the
long-horizon behavior the benchmark is trying to measure.

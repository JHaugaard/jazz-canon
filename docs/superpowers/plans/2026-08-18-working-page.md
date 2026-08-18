# Working — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Working" page to jazzcanon.com — a people-over-time lanes view where every canon musician is a horizontal lane with month-placed session marks, reachable at `#/working` from the masthead nav, clicking through to the existing Constellation.

**Architecture:** A new `people-activity.json` export (produced in the mccoy-tyner repo by the mccoy-tyner-68 session; contract below) is consumed by a pure `people-data.ts` derivation module and rendered by `Working.svelte` as HTML name column + per-row inline SVG lanes inside an internally scrolling page. A ~20-line hash router in `App.svelte` replaces the current view-state toggle, making Home/Working/About linkable routes. No mapping of data facts into code: axis ends, counts, and footnote numbers all come from the export's `meta`.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite, plain SVG. Node 24 (native TS execution) for verification harnesses. No new npm dependencies.

**Spec:** `docs/2026-08-18-who-was-working-spec.md` — the authority when this plan is ambiguous. All decisions D1–D7 RULED by John 2026-08-18: T=4 default; day-ordered jitter; hash router `#/working`; arrival-order lanes; dateless people excluded; page named "Working"; verbatim `YYYY-MM` dates admitted. Plus: intro text block, lorem ipsum for now.

**Dispatch tiers (model-selection.md):** Tasks 1, 2, 3, 5 → `sonnet`. Task 4 (lanes rendering — design-sensitive) → `opus`. Task reviews and final review → `opus`. Never inherit Fable into a subagent.

## Global Constraints

- **Zero new npm dependencies** (runtime or dev).
- **Light scheme only.** Palette vars from `app.css` only (`--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--bn-blue`, `--bn-blue-light`, `--impulse-amber`). Oswald small-caps (`var(--font-display)`, class `display`) for headings/nav; body font for UI text; Lora (`var(--font-serif)`) for the intro's editorial voice. The palette has no red.
- **No data facts hardcoded in app code**: no person ids, no counts, no year endpoints. Axis and footnote derive from `meta`. (Verification harnesses may use concrete values — they are point-in-time checks, not app code.)
- **No name-string joins.** `personId` only; click-through is `nav.openPerson(personId)`.
- **Date strings carry their own precision**: `YYYY-MM-DD` or `YYYY-MM`, length is the contract. Month-grade dates are never rendered as if day-grade (day is only an intra-month ordering input anyway).
- **Undated sessions never become marks** — footnote only, driven by `meta`.
- **Nothing may preclude scrub mode (v1.5)**: the roster is a derived, ordered array; lane rows key by `personId`.
- **Required footnote copy** (epistemic house rule, verbatim): `"Final exit" marks a musician's last appearance in this canon — not death or retirement.`
- **Intro copy lives in `app/src/lib/content/working-intro.txt`** (`?raw` import) so John edits text, not code. Lorem ipsum until he writes it.
- `npm run check` (from `app/`) clean at every commit. Work on branch `working`. Commit per task. **Never push** — deploys are John-only.
- End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Repo facts you need (verified 2026-08-18)

- App lives in `app/` (Vite + Svelte 5, runes). Components in `app/src/lib/`. Static data in `app/public/data/`. There is **no router**: `App.svelte` holds `let view = $state<'timeline' | 'about'>('timeline')` (line ~15) and masthead buttons flip it — Task 3 replaces this.
- **No test suite and none may be added.** Verification: `npm run check`; Node-run harnesses for pure modules (Node 24 executes `.ts` directly); behavioral probes with playwright-core installed in the **session scratchpad**, never the repo. Launch: `chromium.launch({ executablePath: '<home>/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] })` against `npm run dev -- --port 5173` (dev-only `window.__nav` seam) or `npm run preview -- --port 4173` (prod build).
- Data loading pattern: memoized promise per file in `app/src/lib/data.ts` (`loadPlaces` is the model — fetch then pure `build*` transform).
- Pure-module pattern: `app/src/lib/places-data.ts` — no DOM, no fetch, node-runnable, defensive dedupe at load with dev-mode `console.warn` naming ids; `export const DEV` lives there, import it rather than re-deriving.
- Internally scrolling page pattern: `About.svelte` — wrapper `height: 100%; overflow-y: auto;`, `article` max-width 720px centered. `body` keeps `overflow: hidden`.
- Constellation opens via `nav.openPerson(id)` (`nav.svelte.ts`); the FloatingWindow renders in `App.svelte` outside `main`, so it overlays any route.
- `graph.json` people ids are `_jazzcanon.person.id` — the export contract guarantees `personId` membership in that set (validator invariant, mccoy side).
- Site `Search.svelte` handlers in `App.svelte` currently do `view = 'timeline'` before opening panels — Task 3 must convert them to the router equivalent.
- **Contract numbers as of 2026-08-18** (for harnesses; will drift as the canon grows): 445 people, 1,997 session marks, span `1949-01-11` → `1975-12`, cohorts ≥2=202 / ≥3=101 / ≥4=58, meta = 5 undated sessions across 3 albums (`gil-evans-out-of-the-cool`, `june-christy-something-cool-1955`, `lennie-tristano-lennie-tristano-1955`), 40 undated-only people. Anchors: Miles Davis 14 years `1949-01-21`→`1970-01-28`; Paul Chambers 9 years `1955-10-26`→`1965-09-22`; Pat Metheny first=last=`1975-12`. **`spanStart 1949-01-11` legitimately predates the earliest anchor** — it is `lee-konitz-subconscious-lee-1950`, ten days before Birth of the Cool's first date (confirmed by mccoy-tyner-68); the left axis edge is correct, don't "fix" it to match Miles.
- Same-person-same-month collisions max out at depth 2 (48 occurrences canon-wide) — but `laneMarks` must not corrupt output if a future export exceeds 2.

## Cross-repo dependency (Task 1)

**STATUS 2026-08-18 (late): RESOLVED — their pipeline is the source of record.** mccoy-tyner-68's export block landed (mccoy-tyner `1cc1c6e`) with all invariants mutation-tested, and byte-equivalence with this plan's reference SQL was confirmed (`jq -S` identical). Task 1 Step 1 is therefore simply: `cp ~/dev/active/mccoy-tyner/exports/jazz-canon/people-activity.json app/public/data/`. The reference SQL below is retained for contract documentation only — do not regenerate from it.

**THE NUMBERS ARE ABOUT TO MOVE.** John authorized mccoy-tyner-68 to split Out of the Cool's compound session rows (already-sourced obs facts: 1960-11-18 / 1960-11-30 / 1960-12-10 / 1960-12-15) into dated rows. When that lands: `undatedSessions` drops, `undatedAlbums` loses `gil-evans-out-of-the-cool` (footnote settles at 2 albums), `undatedOnlyPeople` falls, people/entries rise; span unchanged. **Before running Task 1, get the re-pin set from mccoy-tyner-68's follow-up message and update every point-in-time fixture in this plan's harness steps** (445 / 1,997 / 5 / 40 / 3-albums / cohort 58 & 101 are all pre-split values). Structural invariants are unaffected.

## File structure

| File | Status | Responsibility |
|---|---|---|
| `app/public/data/people-activity.json` | create (generated) | The export contract file; never hand-edited |
| `app/src/lib/types.ts` | modify | `PersonSession`, `PersonActivity`, `PeopleActivityMeta`, `PeopleActivityFile` (append after `Place`) |
| `app/src/lib/people-data.ts` | create | Pure derivation: validate/dedupe, arrival order, month geometry, jitter, threshold filter. No DOM, node-runnable |
| `app/src/lib/data.ts` | modify | `loadPeopleActivity()` memoized loader |
| `app/src/App.svelte` | modify | Hash router replaces `view` state; "Working" nav button; `Working` route branch |
| `app/src/lib/Working.svelte` | create | The page: intro, threshold stepper, search, axis, lane rows, footnote |
| `app/src/lib/content/working-intro.txt` | create | John-editable intro copy (lorem ipsum) |
| `app/src/vite-env.d.ts` | modify if needed | `*.txt?raw` module declaration if `vite/client` doesn't already cover it |

Verification harnesses (`verify-people-activity.ts`, `verify-people-data.ts`, `probe-working.mjs`) live in the **session scratchpad**, never the repo.

---

### Task 1: The data file + types + loader

**Files:**
- Create: `app/public/data/people-activity.json` (generated, committed)
- Modify: `app/src/lib/types.ts` (append after the Places block)
- Modify: `app/src/lib/data.ts`

**Interfaces:**
- Consumes: the export contract (below); `fetchJson` pattern in `data.ts`.
- Produces: types `PersonSession { date: string; albumId: string }`, `PersonActivity { personId: string; name: string; instruments: string[]; yearsActive: number; first: string; last: string; sessions: PersonSession[] }`, `PeopleActivityMeta { spanStart: string; spanEnd: string; undatedSessions: number; undatedOnlyPeople: number; undatedAlbums: string[] }`, `PeopleActivityFile { people: PersonActivity[]; meta: PeopleActivityMeta }` (types.ts); `loadPeopleActivity(): Promise<PeopleData>` (data.ts — `PeopleData` comes from Task 2; in THIS task declare the loader returning `Promise<PeopleActivityFile>` and Task 2 rewires it through `buildPeopleData`).

- [ ] **Step 1: Obtain the data file.** Preferred: message mccoy-tyner-68 (SendMessage) asking whether their export block landed; if yes: `cp ~/dev/active/mccoy-tyner/exports/jazz-canon/people-activity.json app/public/data/`. Fallback (their gate pending): generate with the reference SQL:

```bash
URL="$(grep -E '^JAZZCANON_DB_URL=' ~/dev/active/mccoy-tyner/.env.local | cut -d= -f2-)"
psql "$URL" -v ON_ERROR_STOP=1 -X -q -At <<'SQL' > app/public/data/people-activity.json
WITH gated AS (
  SELECT a.id FROM _jazzcanon.album a
  WHERE a.canon_status='included' AND a.site_status IN ('approved','live')
),
adm AS (
  SELECT se.album_id,
         coalesce(se.session_date::text,
                  CASE WHEN se.session_date_text ~ '^\d{4}-\d{2}$' THEN se.session_date_text END) AS d
  FROM _jazzcanon.session se JOIN gated g ON g.id = se.album_id
),
mk AS (
  SELECT DISTINCT p.person_id, ad.d, p.album_id
  FROM _jazzcanon.performance p
  JOIN adm ad ON ad.album_id = p.album_id AND ad.d IS NOT NULL
),
per AS (
  SELECT person_id, min(d) AS first, max(d) AS last,
         count(DISTINCT substr(d,1,4))::int AS years
  FROM mk GROUP BY person_id
),
undated AS (
  SELECT se.album_id FROM _jazzcanon.session se JOIN gated g ON g.id=se.album_id
  WHERE se.session_date IS NULL
    AND (se.session_date_text IS NULL OR se.session_date_text !~ '^\d{4}-\d{2}$')
)
SELECT json_build_object(
  'people', (SELECT json_agg(json_build_object(
      'personId', per.person_id,
      'name', pe.canonical_name,
      'instruments', (SELECT json_agg(DISTINCT i.name ORDER BY i.name)
                      FROM _jazzcanon.performance p2
                      JOIN gated g2 ON g2.id = p2.album_id
                      JOIN _jazzcanon.instrument i ON i.id = p2.instrument_id
                      WHERE p2.person_id = per.person_id),
      'yearsActive', per.years,
      'first', per.first,
      'last', per.last,
      'sessions', (SELECT json_agg(json_build_object('date', m.d, 'albumId', m.album_id)
                          ORDER BY m.d, m.album_id)
                   FROM mk m WHERE m.person_id = per.person_id)
    ) ORDER BY per.first, per.person_id)
    FROM per JOIN _jazzcanon.person pe ON pe.id = per.person_id),
  'meta', json_build_object(
    'spanStart', (SELECT min(d) FROM mk),
    'spanEnd',   (SELECT max(d) FROM mk),
    'undatedSessions', (SELECT count(*) FROM undated),
    'undatedOnlyPeople', (SELECT count(DISTINCT p.person_id) FROM _jazzcanon.performance p
                          JOIN gated g ON g.id = p.album_id
                          WHERE NOT EXISTS (SELECT 1 FROM per WHERE per.person_id = p.person_id)),
    'undatedAlbums', (SELECT coalesce(json_agg(DISTINCT album_id), '[]'::json) FROM undated)
  )
);
SQL
```

- [ ] **Step 2: Write the contract harness** — `<scratchpad>/verify-people-activity.ts`, run with `node`. Structural assertions (hold at any canon size): top-level `{people, meta}`; every person has non-empty `sessions`; every `date` matches `^\d{4}-\d{2}(-\d{2})?$` and sits within `[meta.spanStart, meta.spanEnd]`; `first`/`last` equal min/max of that person's dates; `yearsActive` equals the count of distinct `date.slice(0,4)`; no duplicate `personId`; no duplicate `(date, albumId)` within a person; people sorted by `(first, personId)`; every `personId` is a key of `graph.json`'s `people`; every `albumId` is in `albums.json`; and `Object.keys(graph.people).length − people.length === meta.undatedOnlyPeople` — the D5 exclusion set is exactly the graph∖activity delta (mccoy-tyner-68's observation: 485 − 445 = 40), which makes `meta.undatedOnlyPeople` falsifiable from the two files instead of taken on trust. Point-in-time assertions (dated comment: `as of 2026-08-18`): 445 people; `meta.spanStart === '1949-01-11'`, `meta.spanEnd === '1975-12'`; `meta.undatedSessions === 5`, `meta.undatedOnlyPeople === 40`, `meta.undatedAlbums.length === 3`; anchors — Miles Davis `yearsActive 14, first 1949-01-21, last 1970-01-28`; Paul Chambers `9, 1955-10-26, 1965-09-22`; `pat-metheny` present with `first === '1975-12'`.

- [ ] **Step 3: Run the harness — expect PASS.** If any structural assertion fails, the FILE is wrong: do not adjust the harness; fix generation (or report the discrepancy to mccoy-tyner-68) first.

- [ ] **Step 4: Add the types** — append to `app/src/lib/types.ts`:

```ts
/* ---- Working page (people-activity.json contract, ratified 2026-08-18) ---- */

/* date is YYYY-MM-DD or YYYY-MM — string length IS the precision (spec D7). */
export interface PersonSession {
  date: string;
  albumId: string;
}

export interface PersonActivity {
  personId: string; // same id space as GraphData.people — never join on names
  name: string;
  instruments: string[];
  yearsActive: number; // distinct calendar years with ≥1 dated session
  first: string; // earliest dated session — lane start
  last: string; // latest dated session — end-cap
  sessions: PersonSession[];
}

export interface PeopleActivityMeta {
  spanStart: string;
  spanEnd: string;
  undatedSessions: number;
  undatedOnlyPeople: number;
  undatedAlbums: string[];
}

export interface PeopleActivityFile {
  people: PersonActivity[];
  meta: PeopleActivityMeta;
}
```

- [ ] **Step 5: Add the loader** — in `app/src/lib/data.ts`, following the existing pattern (Task 2 rewires the `.then` through `buildPeopleData`):

```ts
let peopleActivityPromise: Promise<PeopleActivityFile> | null = null;

export function loadPeopleActivity(): Promise<PeopleActivityFile> {
  return (peopleActivityPromise ??= fetchJson<PeopleActivityFile>('/data/people-activity.json'));
}
```

(add `PeopleActivityFile` to the type import at the top.)

- [ ] **Step 6: `cd app && npm run check`** — expect clean.

- [ ] **Step 7: Commit** (include the data file):

```bash
git add app/public/data/people-activity.json app/src/lib/types.ts app/src/lib/data.ts
git commit -m "Working data contract: people-activity.json + types + loader"
```

---

### Task 2: Pure derivation module `people-data.ts`

**Files:**
- Create: `app/src/lib/people-data.ts`
- Modify: `app/src/lib/data.ts` (rewire loader through `buildPeopleData`)

**Interfaces:**
- Consumes: `PeopleActivityFile`, `PersonActivity` (types.ts); `DEV` from `./places-data`.
- Produces (later tasks import exactly these names):
  - `interface Mark { m: number; date: string; albumId: string }` — `m` is a continuous month offset from January of `yearStart` (0 = start of that January), mark centered in its month before jitter.
  - `interface PeopleData { people: PersonActivity[]; byId: Map<string, PersonActivity>; meta: PeopleActivityMeta; yearStart: number; yearEnd: number }`
  - `buildPeopleData(raw: PeopleActivityFile): PeopleData` — defensive dedupe of `(date, albumId)` per person (dev-warn naming the personId), drops zero-session people (dev-warn), re-sorts people by `(first, personId)` and sessions by `(date, albumId)`; `yearStart`/`yearEnd` from `meta.spanStart`/`meta.spanEnd` year prefixes.
  - `monthOffset(date: string, yearStart: number): number` — `(year − yearStart) * 12 + (month − 1) + 0.5`.
  - `dayOrder(date: string): number` — day-of-month for `YYYY-MM-DD`, `0` for `YYYY-MM` (month-grade sorts first within its month).
  - `laneMarks(p: PersonActivity, yearStart: number): Mark[]` — sessions grouped by month key `date.slice(0, 7)`; groups of 1 → mark at month center; groups of N ≥ 2 → spread evenly across `±JITTER` (`const JITTER = 0.22` months), ordered by `(dayOrder, albumId)`. Contract says max depth 2; N > 2 must still produce distinct, ordered, in-range positions (defensive).
  - `filterByYears(people: PersonActivity[], minYears: number): PersonActivity[]` — order-preserving filter on `yearsActive >= minYears`.

- [ ] **Step 1: Write the module** per the interface block above, in the house style of `places-data.ts` (pure, no DOM, comments carry contract constraints not narration).

- [ ] **Step 2: Rewire the loader** in `data.ts`:

```ts
import { buildPeopleData, type PeopleData } from './people-data';

let peopleActivityPromise: Promise<PeopleData> | null = null;

export function loadPeopleActivity(): Promise<PeopleData> {
  return (peopleActivityPromise ??= fetchJson<PeopleActivityFile>('/data/people-activity.json').then(buildPeopleData));
}
```

- [ ] **Step 3: Write the derivation harness** — `<scratchpad>/verify-people-data.ts`, run with `node`, importing the module by absolute path and feeding it the REAL `people-activity.json`. Two kinds of checks:
  - Real-data checks (write assertions directly): `buildPeopleData` output has 445 people (dated comment), arrival order holds (`people[i].first <= people[i+1].first` or tie-broken by id), `byId.get('paul-chambers')` (resolve actual id from the file, don't guess) matches the Task-1 anchor, `yearStart === 1949`, `yearEnd === 1975`, `filterByYears(people, 4).length === 58` and `(…, 3).length === 101`, total marks across all people === 1,997.
  - Rule-pinning checks (workflow-rules: state the rule and the mutant; the implementer writes assertions and proves the mutant dies by temporarily applying it and watching the harness fail):
    1. **Rule:** `monthOffset` places `1949-01-11` and `1949-01` both at `0.5` for `yearStart = 1949` (day never shifts the month position). **Mutant that must fail:** an implementation that incorporates the day (e.g. `+ day/31`).
    2. **Rule:** same-month groups order by day, month-grade first. **Mutant that must fail:** ignoring `dayOrder` and spreading by `albumId` alone — find a real depth-2 month with two distinct days (48 exist) and assert relative order of the two `m` values.
    3. **Rule:** jittered marks stay inside their month (`|m − center| ≤ JITTER < 0.5`). **Mutant that must fail:** a jitter of ±0.6.

- [ ] **Step 4: Run the harness; apply each named mutant, watch it fail, revert.** All green at the end.

- [ ] **Step 5: `cd app && npm run check`** — expect clean.

- [ ] **Step 6: Commit:**

```bash
git add app/src/lib/people-data.ts app/src/lib/data.ts
git commit -m "Working data layer: pure derivation (arrival order, month geometry, jitter, threshold)"
```

---

### Task 3: Hash router + nav + page skeleton with intro

**Files:**
- Modify: `app/src/App.svelte`
- Create: `app/src/lib/Working.svelte` (skeleton this task; lanes in Task 4)
- Create: `app/src/lib/content/working-intro.txt`
- Modify (only if `npm run check` complains about the `?raw` import): `app/src/vite-env.d.ts` with `declare module '*.txt?raw' { const text: string; export default text; }`

**Interfaces:**
- Consumes: `loadPeopleActivity` (Task 2), `nav` (nav.svelte.ts).
- Produces: route type `Route = 'home' | 'working' | 'about'`; `Working.svelte` props `{ onOpenPerson: (pid: string) => void }`. Task 4 builds inside `Working.svelte`; Task 5 adds controls to it.

- [ ] **Step 1: Router in `App.svelte`.** Replace `let view = $state<'timeline' | 'about'>('timeline')` and `goHome` with:

```ts
type Route = 'home' | 'working' | 'about';

function parseHash(): Route {
  const h = window.location.hash;
  if (h.startsWith('#/working')) return 'working';
  if (h.startsWith('#/about')) return 'about';
  return 'home';
}

let route = $state<Route>(parseHash());

function go(r: Route) {
  window.location.hash = r === 'home' ? '#/' : `#/${r}`;
}

function goHome() {
  go('home');
  nav.close();
}
```

Add `onhashchange={() => (route = parseHash())}` to the existing `<svelte:window>` element. Nav becomes Home · Working · About (`class:active={route === 'working'}` etc., `onclick={() => go('working')}`). Search handlers change `view = 'timeline'` → `go('home')`. Main branch:

```svelte
{#if route === 'about'}
  <About onopen={(id) => nav.openAlbum(id)} />
{:else if route === 'working'}
  <Working onOpenPerson={(pid) => nav.openPerson(pid)} />
{:else if loadError}
  … (existing branches unchanged)
```

- [ ] **Step 2: Intro copy file** — `app/src/lib/content/working-intro.txt`, plain paragraphs separated by blank lines (John edits this file directly; no markup):

```
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
```

- [ ] **Step 3: `Working.svelte` skeleton** — internally scrolling page (About pattern), loading the data, rendering title + intro + a placeholder for the lane field + the meta-driven footnote:

```svelte
<script lang="ts">
  import { loadPeopleActivity } from './data';
  import type { PeopleData } from './people-data';
  import introRaw from './content/working-intro.txt?raw';

  let { onOpenPerson }: { onOpenPerson: (pid: string) => void } = $props();

  const paragraphs = introRaw.trim().split(/\n\s*\n/);

  let data = $state<PeopleData | null>(null);
  let loadError = $state<string | null>(null);

  loadPeopleActivity()
    .then((d) => (data = d))
    .catch((e) => (loadError = String(e)));
</script>

<div class="working">
  <article>
    <h1 class="display">Working</h1>
    {#each paragraphs as p}
      <p class="intro">{p}</p>
    {/each}
  </article>

  {#if loadError}
    <p class="fatal">Couldn't load the activity data ({loadError}).</p>
  {:else if !data}
    <p class="fatal">Loading…</p>
  {:else}
    <!-- lane field lands here in Task 4 -->
    <p class="footnote">
      {data.meta.undatedSessions} sessions across {data.meta.undatedAlbums.length}
      albums carry no usable date and are not drawn; {data.meta.undatedOnlyPeople}
      musicians appear only on those sessions. “Final exit” marks a musician's
      last appearance in this canon — not death or retirement.
    </p>
  {/if}
</div>

<style>
  .working { height: 100%; overflow-y: auto; background: var(--bg); }
  article { max-width: 720px; margin: 0 auto; padding: 40px 28px 8px; }
  h1 { font-size: 40px; color: var(--bn-blue); letter-spacing: 0.02em; margin-bottom: 10px; }
  .intro { font-family: var(--font-serif); font-size: 16px; line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  .fatal { padding: 30px; color: var(--muted); }
  .footnote { max-width: 940px; margin: 18px auto 48px; padding: 0 28px; font-size: 13px; color: var(--muted); line-height: 1.55; }
  @media (max-width: 620px) {
    article { padding: 26px 18px 6px; }
    h1 { font-size: 30px; }
  }
</style>
```

(`onOpenPerson` is consumed in Task 4 — Svelte 5 tolerates the unused prop meanwhile; if `npm run check` flags it, reference it in a comment-level no-op and remove in Task 4.)

- [ ] **Step 4: `cd app && npm run check`** — expect clean (add the `vite-env.d.ts` declaration only if the `?raw` import is flagged).

- [ ] **Step 5: Probe** — `<scratchpad>/probe-working-route.mjs` against `npm run dev -- --port 5173`: navigate to `http://localhost:5173/#/working`, assert `h1` text is `Working`; click the Home nav button, assert the timeline renders; navigate browser Back, assert the Working page returns (hash routing gives history for free — confirm it).

- [ ] **Step 6: Commit:**

```bash
git add app/src/App.svelte app/src/lib/Working.svelte app/src/lib/content/working-intro.txt
git commit -m "Working route: hash router, nav entry, page skeleton with intro + meta footnote"
```

(add `app/src/vite-env.d.ts` if modified.)

---

### Task 4: Lane field rendering — **dispatch on `opus`**

**Files:**
- Modify: `app/src/lib/Working.svelte`

**Interfaces:**
- Consumes: `laneMarks`, `monthOffset`, `filterByYears`, `Mark`, `PeopleData` (people-data.ts); `albumMap()` (data.ts) for mark tooltips; `onOpenPerson` prop.
- Produces: the lane-field markup/CSS that Task 5's controls plug into: a `roster` derived array and a `minYears` state (initialized `4` — spec D1) that Task 5's stepper mutates; row element id pattern `lane-{personId}` that Task 5's search scrolls to.

Rendering design (the spec's visual grammar, made concrete):

- Constants: `const PX_PER_MONTH = 3.4;` `const ROW_H = 26;` — total width = `(yearEnd − yearStart + 1) * 12 * PX_PER_MONTH` (≈1,100px for the current span; derived, never hardcoded).
- Layout: a `.lanes-scroll` container (`overflow-x: auto`) holding one CSS-grid row per musician: `grid-template-columns: 180px 1fr`; the name cell `position: sticky; left: 0; background: var(--bg)` so names hold during horizontal scroll on narrow screens. Axis row (year labels at each January x-position, small `--muted` text, vertical hairlines every year across the field) is `position: sticky; top: 0` inside the scroll container.
- Each lane cell: inline `<svg width={W} height={ROW_H}>`:
  - between-marks line: `<line x1={monthOffset(p.first, yearStart) * PX_PER_MONTH} x2={monthOffset(p.last, yearStart) * PX_PER_MONTH} y1={ROW_H/2} y2={ROW_H/2} stroke="var(--line)" stroke-width="1" />` — the hiatus IS this line continuing; no special casing.
  - marks: `<circle cx={mk.m * PX_PER_MONTH} cy={ROW_H/2} r="3.2" fill="var(--bn-blue)">` with `<title>{albums.get(mk.albumId)?.title ?? mk.albumId} — {mk.date}</title>` (native tooltip; the `?? mk.albumId` fallback is honest-visible, never silent).
  - end-cap at `last`: `<rect x={lastX - 0.75} y={6} width="1.5" height={ROW_H - 12} fill="var(--bn-blue)" />` — a quiet terminal tick.
- Row interaction: whole row is a `<button class="lane-row">` (accessible click target) → `onOpenPerson(p.personId)`; hover tints the row `var(--surface)`; name in body font 13.5px, `--ink`, with `instruments[0]` in `--muted` after it when present.
- Roster: `let minYears = $state(4);` `let roster = $derived(data ? filterByYears(data.people, minYears) : []);` — arrival order comes from `data.people` order; rows keyed `{#each roster as p (p.personId)}`.
- A single count line above the field: `{roster.length} musicians · active in at least {minYears} {minYears === 1 ? 'year' : 'years'} of the canon` (Task 5 attaches the stepper next to it).

- [ ] **Step 1: Implement** the above in `Working.svelte` (replacing the Task-3 placeholder; consume `onOpenPerson`).
- [ ] **Step 2: `cd app && npm run check`** — clean.
- [ ] **Step 3: Probe** — `<scratchpad>/probe-working-lanes.mjs` (dev server): on `#/working`, assert row count === 58 (dated comment: T=4 cohort as of 2026-08-18); assert the first row's name cell (arrival order — read expected name from the JSON at probe-time, not hardcoded); click a row known to be in the T=4 cohort (resolve Paul Chambers' id from the JSON) and assert the Constellation FloatingWindow opens (`.window` / `aria-label="Constellation"` present, matching how the Places probes asserted it).
- [ ] **Step 4: Commit:**

```bash
git add app/src/lib/Working.svelte
git commit -m "Working lanes: arrival-ordered rows, month-placed marks, jitter, end-caps, click-through"
```

---

### Task 5: Threshold stepper + search + polish of the controls row

**Files:**
- Modify: `app/src/lib/Working.svelte`

**Interfaces:**
- Consumes: `minYears` state, `roster` derived, `lane-{personId}` row ids (Task 4); `data.people` for the search corpus.
- Produces: the finished control row; `pinned: Set<string>` state folded into the roster derivation.

- [ ] **Step 1: Stepper** — four `.nav-btn`-styled buttons `1 / 2 / 3 / 4+` setting `minYears` (active state mirrors the masthead's `.nav-link.active` treatment: `--bn-blue` + amber underline). The count line from Task 4 sits beside it and updates.

- [ ] **Step 2: Search** — a text input in the controls row, placeholder `Find any musician…`. Matching: case-insensitive substring over `data.people` names, first 8 results in a small dropdown list. Picking one:

```ts
let pinned = $state<Set<string>>(new Set());
let highlightId = $state<string | null>(null);

async function pickPerson(pid: string) {
  pinned = new Set([...pinned, pid]);
  query = '';
  highlightId = pid;
  await tick();
  document.getElementById(`lane-${pid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => (highlightId = null), 2400);
}
```

Roster derivation becomes: `data.people.filter((p) => p.yearsActive >= minYears || pinned.has(p.personId))` — order-preserving, so pinned people appear at their arrival position, highlighted (`class:hl={p.personId === highlightId}`, a soft amber background `rgba(196, 134, 42, 0.14)` fading via CSS transition). Threshold changes never remove pinned people (spec: threshold governs the default roster, never access).

- [ ] **Step 3: `cd app && npm run check`** — clean.
- [ ] **Step 4: Probe** — extend `<scratchpad>/probe-working-lanes.mjs`: set threshold to 1, assert 445 rows (dated); back to 4, assert 58; type a name known to be below T=4 (resolve one with `yearsActive === 1` from the JSON at probe-time), pick it, assert its row exists and carries the highlight class, and that row count is 59.
- [ ] **Step 5: Commit:**

```bash
git add app/src/lib/Working.svelte
git commit -m "Working controls: threshold stepper, always-access search with pin + highlight"
```

---

### Task 6: Visual preview gate — **HARD STOP for John**

**Files:** none (scratchpad probes + screenshots only).

- [ ] **Step 1: Build + preview** — `cd app && npm run build && npm run preview -- --host --port 4173` (prod build, reachable at `http://vps8-core:4173/#/working` over Tailscale).
- [ ] **Step 2: Screenshot set** — `<scratchpad>/probe-working-shots.mjs` against the preview: `#/working` at 1440×900, 1024×768, 390×844; default T=4, plus one shot at T=1 (density stress), one with a searched-in below-threshold musician highlighted, one hover state near a jittered ×2 month. Save PNGs to the scratchpad.
- [ ] **Step 3: STOP.** Present the screenshots and the live preview URL to John. He rules on: jitter vs ×2 glyph (D2 final), mark size/line weight, intro block placement, row height/density, responsive behavior, anything else. **No further tasks until he speaks.** Record his tuning notes as checklist items in this plan file under this task.
- [ ] **Step 4:** Apply John's tuning rulings (each as its own small commit, message prefix `Working tune:`), re-shoot, re-present until approved.

---

### Task 7: Final verification + review

- [ ] **Step 1: Full harness re-run** — `verify-people-activity.ts`, `verify-people-data.ts`, both probe scripts: all green against the final code.
- [ ] **Step 2: `cd app && npm run check`** — clean.
- [ ] **Step 3: Manual sweep of the spec** (§3 checklist): axis data-driven both ends; footnote meta-driven with the verbatim epistemic line; no hardcoded counts/ids/years in `app/src/` (grep for `1949`, `1975`, `445`, `58` in `app/src/lib/Working.svelte` and `people-data.ts` — only `yearStart`-derived values allowed); dates never rendered beyond their precision; roster keyed by `personId`.
- [ ] **Step 4: Code review** — superpowers:requesting-code-review on the branch diff (`opus`), fix what's real.
- [ ] **Step 5: Update `docs/DECISIONS.md`** with a dated entry: Working page shipped to branch; D1–D7 rulings one line each, pointer to the spec.
- [ ] **Step 6: Final commit; report to John.** Merging/deploy is John's (ship.sh runs from the mccoy-tyner side; site deploy is John-only).

---

## Coordination notes

- **mccoy-tyner-68** owns `export.sh`/`publish.sh`/`ship.sh` changes (incl. the places.json gap-fix) behind John's proposal-first gate in that session. The finalized contract (shape + reference SQL, identical to Task 1's) was sent 2026-08-18. If their export lands before Task 1 runs, prefer their file; afterwards, verify byte-equivalence (`diff <(jq -S . theirs) <(jq -S . ours)`) and adopt theirs — the committed site file must trace to the pipeline, with the fallback SQL as bootstrap only.
- The canon drips: point-in-time numbers (445/1,997/58/…) in harnesses carry a dated comment and are expected to drift after future data ships. Structural invariants are the durable layer.

## Self-review (done at write time)

- Spec coverage: §2 export → Task 1 + coordination; §3 nav/layout/components/lanes/threshold/search → Tasks 3–5; intro block → Task 3; §4 scrub-mode non-preclusion → derived roster array (Task 4); §5 non-goals — nothing here builds them; §7 verification → Tasks 1, 2, 6, 7. D1–D7 all land in concrete steps.
- No placeholders: every step carries code, exact values, or a named rule+mutant.
- Type consistency: `PersonActivity`/`PeopleData`/`Mark`/`laneMarks`/`filterByYears`/`monthOffset`/`loadPeopleActivity` names match across Tasks 1–5; row id `lane-{personId}` consistent between Tasks 4 and 5.

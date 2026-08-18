<script lang="ts">
  import { tick } from 'svelte';
  import { albumMap, loadPeopleActivity } from './data';
  import { laneMarks, monthOffset } from './people-data';
  import type { Mark, PeopleData } from './people-data';
  import type { AlbumCard, PersonActivity } from './types';
  import introRaw from './content/working-intro.txt?raw';

  let {
    onOpenPerson,
    onOpenAlbum,
  }: { onOpenPerson: (pid: string) => void; onOpenAlbum: (aid: string) => void } = $props();

  const paragraphs = introRaw.trim().split(/\n\s*\n/);

  /* Lane geometry. The month is the finest unit the data can honestly place,
     so the field is measured in months and the year is simply twelve of them.
     Span, width and axis all derive from the loaded data — nothing here knows
     which years the canon covers. */
  const PX_PER_MONTH = 5;
  const PX_PER_YEAR = PX_PER_MONTH * 12;
  const ROW_H = 26;
  /* A mark at January of yearStart sits half a month into the field and is
     6.4px wide, so without a gutter the SVG viewport (overflow: hidden by
     default) shaves the 1949 cohort's first marks — and the same at the far
     end. The gutter pads both ends and every x in the field is offset through
     xm(), axis ticks and hairlines included, so the year columns still line up. */
  const GUTTER = 5;
  const xm = (months: number) => GUTTER + months * PX_PER_MONTH;

  let data = $state<PeopleData | null>(null);
  let loadError = $state<string | null>(null);
  let albums = $state<Map<string, AlbumCard>>(new Map());
  let albumsError = $state<string | null>(null);

  loadPeopleActivity()
    .then((d) => (data = d))
    .catch((e) => (loadError = String(e)));

  /* Album titles are tooltip garnish, not lane data: if albums.json fails the
     lanes still draw and every mark names its album id instead. Degraded, and
     said out loud below — never silently. */
  albumMap()
    .then((m) => (albums = m))
    .catch((e) => (albumsError = String(e)));

  let minYears = $state(4);

  /* Search + pin. Threshold governs the default roster, never access: once a
     musician is pinned by search they stay in the field at their arrival
     position regardless of later threshold changes. */
  let query = $state('');
  let searchOpen = $state(false);
  let activeIndex = $state(-1);
  let pinned = $state<Set<string>>(new Set());
  let highlightId = $state<string | null>(null);

  let roster = $derived(
    data ? data.people.filter((p) => p.yearsActive >= minYears || pinned.has(p.personId)) : []
  );

  let results = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!data || !q) return [];
    return data.people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  });
  let showDropdown = $derived(searchOpen && results.length > 0);

  function onSearchInput() {
    searchOpen = true;
    activeIndex = -1;
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      searchOpen = false;
      activeIndex = -1;
    } else if (e.key === 'ArrowDown') {
      if (results.length) {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % results.length;
      }
    } else if (e.key === 'ArrowUp') {
      if (results.length) {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + results.length) % results.length;
      }
    } else if (e.key === 'Enter') {
      const pick = results[activeIndex] ?? results[0];
      if (pick) {
        e.preventDefault();
        pickPerson(pick.personId);
      }
    }
  }

  /* One timer, cancelled on every new pin: two searches inside 2.4s would
     otherwise let the first pin's timer clear the second pin's highlight. */
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  async function pickPerson(pid: string) {
    if (highlightTimer !== null) clearTimeout(highlightTimer);
    pinned = new Set([...pinned, pid]);
    query = '';
    searchOpen = false;
    activeIndex = -1;
    highlightId = pid;
    await tick();
    document.getElementById(`lane-${pid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    highlightTimer = setTimeout(() => {
      highlightId = null;
      highlightTimer = null;
    }, 2400);
  }

  /* and cancelled on teardown, so it can't fire into a destroyed component
     when the route changes mid-highlight */
  $effect(() => () => {
    if (highlightTimer !== null) clearTimeout(highlightTimer);
  });

  /* One month, one target. Marks are grouped back into the calendar month they
     came from: laneMarks spreads a shared month across ±0.22 of a month around
     its centre, so flooring m recovers the month index exactly, and a mark's
     own x is always nearer its own month's centre (≤1.1px) than any
     neighbouring month's (≥3.9px at this pitch). Per-mark hit shapes cannot
     make that promise — at 5px per month a 12px target covers its neighbours,
     which is how the field spent a while naming the wrong session. */
  interface MonthGroup {
    mi: number; // month index from January of yearStart
    cx: number; // that month's centre, in the lane SVG's coordinates
    marks: Mark[];
  }

  function monthGroups(p: PersonActivity, yearStart: number): MonthGroup[] {
    const byMonth = new Map<number, Mark[]>();
    for (const mk of laneMarks(p, yearStart)) {
      const mi = Math.floor(mk.m);
      const list = byMonth.get(mi);
      if (list) list.push(mk);
      else byMonth.set(mi, [mk]);
    }
    return [...byMonth.entries()]
      .map(([mi, marks]) => ({ mi, cx: xm(mi + 0.5), marks }))
      .sort((a, b) => a.mi - b.mi);
  }

  /* How far from a month's centre still counts as pointing at it. Half the old
     12px target: generous, and — unlike that target — it cannot resolve to the
     wrong month, because the nearest centre wins and centres are a whole month
     apart. */
  const HOVER_PX = 6;

  function groupAt(groups: MonthGroup[], x: number): MonthGroup | null {
    let best: MonthGroup | null = null;
    let bestD = Infinity;
    for (const g of groups) {
      const d = Math.abs(g.cx - x);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best && bestD <= HOVER_PX ? best : null;
  }

  /* x inside the lane SVG. The band spans the SVG exactly and the SVG has no
     viewBox, so its client rect maps 1:1 onto lane coordinates. */
  function laneX(e: MouseEvent, band: Element): number {
    return e.clientX - band.getBoundingClientRect().left;
  }

  /* Tooltip. The native <title> it replaces was correct but arrived on the
     OS's ~1s delay, so nobody discovered it: this one is instant. It names
     every session in the month it resolved, one per line — a month can hold
     five of them, and saying so is the honest reading of a cluster that is
     physically one dot wide. Anchor is the month's centre in viewport
     coordinates (position: fixed, so the field's own overflow can never clip
     it); the effect below measures the rendered card and clamps it inside the
     viewport, and `placed` keeps it hidden for the frame before that
     measurement exists. */
  let tip = $state<{ lines: string[]; key: string; ax: number; ay: number } | null>(null);
  let tipEl = $state<HTMLDivElement | null>(null);
  let tipPos = $state({ left: 0, top: 0 });
  let placed = $state(false);

  function sessionLine(mk: Mark): string {
    return `${albums.get(mk.albumId)?.title ?? mk.albumId} — ${mk.date}`;
  }

  /* Delegated from the row button: mouse handlers belong on an element that is
     already interactive, and the band itself is aria-hidden decoration. */
  function onLaneMove(e: MouseEvent, personId: string, groups: MonthGroup[]) {
    const band = e.target as Element | null;
    if (!(band instanceof Element) || !band.classList.contains('hit-band')) {
      hideTip();
      return;
    }
    const box = band.getBoundingClientRect();
    const g = groupAt(groups, e.clientX - box.left);
    if (!g) {
      hideTip();
      return;
    }
    const key = `${personId}:${g.mi}`;
    if (tip?.key === key) return; // same month: don't re-render on every pixel
    placed = false;
    tip = { lines: g.marks.map(sessionLine), key, ax: box.left + g.cx, ay: box.top };
  }

  function hideTip() {
    tip = null;
    placed = false;
  }

  /* Two destinations, one handler, no nested click target: a click that lands
     on a month opens that month's album, a click anywhere else on the row
     opens the musician's constellation. Delegating here is what keeps the row
     a plain <button> — the band and the marks stay decoration (aria-hidden),
     so there is no button inside a button and no second tab stop.

     When a month holds sessions from more than one album, the exact x picks
     the nearest mark: the marks are spread within the month in date order, so
     the choice follows where the pointer actually is. It is a sub-pixel
     distinction at this pitch, which is why the tooltip lists every session in
     the month — the reader is told what is there before they click.

     Constraint: the band is a pointer shortcut only; every album it reaches is
     still keyboard-reachable through the constellation the row opens, so its
     lack of focus is deliberate, not an oversight. */
  function onRowClick(e: MouseEvent, personId: string, groups: MonthGroup[]) {
    hideTip();
    const band = e.target as Element | null;
    if (band instanceof Element && band.classList.contains('hit-band')) {
      const x = laneX(e, band);
      const g = groupAt(groups, x);
      if (g) {
        const ids = new Set(g.marks.map((mk) => mk.albumId));
        const pick =
          ids.size === 1
            ? g.marks[0]
            : g.marks.reduce((a, b) => (Math.abs(xm(b.m) - x) < Math.abs(xm(a.m) - x) ? b : a));
        onOpenAlbum(pick.albumId);
        return;
      }
    }
    onOpenPerson(personId);
  }

  $effect(() => {
    const t = tip;
    const el = tipEl;
    if (!t || !el) return;
    const pad = 6;
    const gap = 7;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const above = t.ay - h - gap;
    tipPos = {
      left: Math.min(Math.max(t.ax - w / 2, pad), window.innerWidth - w - pad),
      /* flips below the mark rather than off the top of the window */
      top: above >= pad ? above : t.ay + ROW_H + gap,
    };
    placed = true;
  });

  let years = $derived.by(() => {
    const d = data;
    if (!d) return [];
    return Array.from({ length: d.yearEnd - d.yearStart + 1 }, (_, i) => d.yearStart + i);
  });
  let fieldW = $derived(years.length * PX_PER_YEAR);
  let svgW = $derived(fieldW + GUTTER * 2);

  /* The undated clause disappears entirely once every session carries a date —
     it must never claim something about a set that no longer exists — and each
     count carries its own noun, because "1 sessions across 1 albums" is one
     data ship away. */
  let undatedNote = $derived.by(() => {
    const m = data?.meta;
    if (!m || m.undatedSessions === 0) return '';
    const s = m.undatedSessions;
    const a = m.undatedAlbums.length;
    const q = m.undatedOnlyPeople;
    return (
      `${s} ${s === 1 ? 'session' : 'sessions'} across ${a} ${a === 1 ? 'album' : 'albums'} ` +
      `${s === 1 ? 'carries' : 'carry'} no usable date and ${s === 1 ? 'is' : 'are'} not drawn; ` +
      `${q} ${q === 1 ? 'musician appears' : 'musicians appear'} only on those sessions.`
    );
  });
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
  {:else if data}
    {@const yearStart = data.yearStart}
    <section
      class="field-wrap"
      style:--field-w="{fieldW}px"
      style:--year-w="{PX_PER_YEAR}px"
      style:--row-h="{ROW_H}px"
      style:--gutter="{GUTTER}px"
    >
      <div class="controls">
        <div class="stepper" role="group" aria-label="Minimum years active">
          <!-- widest threshold first: 4+ is the default and the reading most
               people want, so it sits where the eye lands -->
          {#each [4, 3, 2, 1] as n}
            <button
              type="button"
              class="nav-btn step-btn"
              class:active={minYears === n}
              aria-pressed={minYears === n}
              onclick={() => (minYears = n)}
            >{n === 4 ? '4+' : n}</button>
          {/each}
        </div>

        <p class="count">
          {roster.length} musicians · active in at least {minYears}
          {minYears === 1 ? 'year' : 'years'} of the canon
        </p>

        <div class="search-wrap">
          <input
            type="text"
            class="search-input"
            placeholder="Find any musician…"
            bind:value={query}
            oninput={onSearchInput}
            onkeydown={onSearchKeydown}
            onblur={() => (searchOpen = false)}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-label="Find any musician"
          />
          {#if showDropdown}
            <ul
              class="search-results"
              id="search-results"
              role="listbox"
              onmousedown={(e) => e.preventDefault()}
            >
              {#each results as r, i (r.personId)}
                <li role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    class="result-btn"
                    class:active={i === activeIndex}
                    onclick={() => pickPerson(r.personId)}
                  >{r.name}</button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      {#if albumsError}
        <p class="degraded">
          Album titles unavailable ({albumsError}) — marks show their album id instead.
        </p>
      {/if}

      <div class="lanes-scroll" onscroll={hideTip}>
        <div class="field">
          <div class="axis">
            <div class="axis-name"></div>
            <div class="axis-track">
              {#each years as y}
                {@const yearX = xm((y - yearStart) * 12)}
                <span class="tick" style:left="{yearX}px"></span>
                <span
                  class="tick-label display"
                  class:minor={y % 5 !== 0}
                  style:left="{yearX + 4}px"
                >{y % 5 === 0 ? y : `’${String(y).slice(2)}`}</span>
              {/each}
            </div>
          </div>

          {#each roster as p (p.personId)}
            {@const firstX = xm(monthOffset(p.first, yearStart))}
            {@const lastX = xm(monthOffset(p.last, yearStart))}
            {@const instruments = p.instruments.join(', ')}
            {@const groups = monthGroups(p, yearStart)}
            <button
              class="lane-row"
              class:hl={p.personId === highlightId}
              id="lane-{p.personId}"
              aria-label="{p.name} — open constellation"
              onclick={(e) => onRowClick(e, p.personId, groups)}
              onmousemove={(e) => onLaneMove(e, p.personId, groups)}
              onmouseout={hideTip}
              onfocus={hideTip}
              onblur={hideTip}
            >
              <span class="lane-name">
                <span class="who">{p.name}</span>
                {#if instruments}
                  <!-- the export's instruments array is alphabetical, not
                       primacy-ordered, so the whole list goes out: picking one
                       would name Miles Davis a flugelhorn player. -->
                  <span class="inst" title={instruments}>{instruments}</span>
                {/if}
              </span>
              <span class="lane-cell">
                <!-- aria-hidden: the row's own label carries the meaning, and
                     the marks are a picture of it, not a second reading. -->
                <svg width={svgW} height={ROW_H} aria-hidden="true">
                  <!-- first→last, drawn straight through every gap: a hiatus is
                       this line continuing, and is never special-cased. -->
                  <line
                    x1={firstX}
                    x2={lastX}
                    y1={ROW_H / 2}
                    y2={ROW_H / 2}
                    stroke="var(--line)"
                    stroke-width="1"
                  />
                  {#each groups as g}
                    {#each g.marks as mk}
                      <circle cx={xm(mk.m)} cy={ROW_H / 2} r="3.2" fill="var(--bn-blue)" />
                    {/each}
                  {/each}
                  <!-- final exit: the last session in this canon, nothing more -->
                  <rect
                    class="cap"
                    x={lastX - 0.75}
                    y="6"
                    width="1.5"
                    height={ROW_H - 12}
                    fill="var(--bn-blue)"
                  />
                  <!-- one hit target for the whole lane: the month under the
                       pointer is worked out from x, never from which shape the
                       browser happened to find first -->
                  <rect class="hit-band" x="0" y="0" width={svgW} height={ROW_H} />
                </svg>
              </span>
            </button>
          {/each}
        </div>
      </div>
    </section>

    <p class="footnote">
      {#if undatedNote}{undatedNote}{/if}
      “Final exit” marks a musician's last appearance in this canon — not death
      or retirement.
    </p>
  {:else}
    <p class="fatal">Loading…</p>
  {/if}

  {#if tip}
    <div
      class="lane-tip"
      class:placed
      bind:this={tipEl}
      style:left="{tipPos.left}px"
      style:top="{tipPos.top}px"
    >
      {#each tip.lines as line}
        <div class="tip-line">{line}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .working { height: 100%; overflow-y: auto; background: var(--bg); }
  article { max-width: 720px; margin: 0 auto; padding: 40px 28px 8px; }
  h1 { font-size: 40px; color: var(--bn-blue); letter-spacing: 0.02em; margin-bottom: 10px; }
  .intro { font-family: var(--font-serif); font-size: 16px; line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  .fatal { padding: 30px; color: var(--muted); }
  .footnote { max-width: 940px; margin: 18px auto 48px; padding: 0 28px; font-size: 13px; color: var(--muted); line-height: 1.55; }

  /* --name-w is layout, not data, so it lives in CSS and can be narrowed for
     phones; --field-w / --year-w / --row-h come from the data's own span. */
  .field-wrap {
    --name-w: 200px;
    max-width: calc(var(--name-w) + var(--field-w) + 2 * var(--gutter) + 56px);
    margin: 26px auto 0;
    padding: 0 28px;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 18px;
    margin: 0 0 9px;
  }
  .count { margin: 0; font-size: 13px; color: var(--muted); }
  .degraded { margin: 0 0 9px; font-size: 12.5px; color: var(--impulse-amber); }

  .stepper { display: flex; gap: 4px; }
  .step-btn { color: var(--muted); cursor: pointer; }
  .step-btn:hover { color: var(--bn-blue); border-color: var(--bn-blue-light); }
  .step-btn.active {
    color: var(--bn-blue);
    border-color: var(--bn-blue-light);
    background: var(--surface);
  }
  /* echoes the masthead's .nav-link.active: bn-blue text + amber underline */
  .step-btn.active::after {
    content: '';
    display: block;
    height: 2px;
    background: var(--impulse-amber);
    margin-top: 3px;
    border-radius: 2px;
  }

  .search-wrap { position: relative; margin-left: auto; }
  .search-input {
    width: 220px;
    max-width: 100%;
    font-family: inherit;
    font-size: 13px;
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 5px 10px;
  }
  .search-input:focus { outline: none; border-color: var(--bn-blue-light); }
  .search-results {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 6px;
    max-height: 260px;
    overflow-y: auto;
  }
  .result-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 13px;
    color: var(--ink);
    cursor: pointer;
  }
  .result-btn:hover,
  .result-btn.active { background: var(--surface); color: var(--bn-blue); }

  /* The field scrolls in its own box so the year axis stays pinned above the
     lanes however far down the roster you read. */
  .lanes-scroll {
    max-height: 70dvh;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }
  .field { width: calc(var(--name-w) + var(--field-w) + 2 * var(--gutter)); }

  .axis {
    position: sticky;
    top: 0;
    z-index: 3;
    display: grid;
    grid-template-columns: var(--name-w) 1fr;
    height: 30px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .axis-name { position: sticky; left: 0; z-index: 4; background: var(--bg); }
  .axis-track { position: relative; }
  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 6px;
    background: var(--muted);
    opacity: 0.45;
  }
  .tick-label {
    position: absolute;
    bottom: 7px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .tick-label.minor { font-size: 10.5px; opacity: 0.65; }

  .lane-row {
    --row-bg: var(--bg);
    display: grid;
    grid-template-columns: var(--name-w) 1fr;
    align-items: center;
    width: 100%;
    height: var(--row-h);
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--row-bg);
    text-align: left;
    color: inherit;
    /* transition lives on the base rule (not just .hl) so the amber tint
       fades in on pin AND fades out again when highlightId clears */
    transition: background-color 0.9s ease;
  }
  .lane-row:hover { --row-bg: var(--surface); }
  .lane-row:focus-visible { outline: 2px solid var(--bn-blue-light); outline-offset: -2px; }
  /* search-pinned row: tints --row-bg (not background directly) so the
     sticky name cell, which reads the same custom property, tints too */
  .lane-row.hl { --row-bg: rgba(196, 134, 42, 0.14); }

  .lane-name {
    position: sticky;
    left: 0;
    z-index: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
    height: 100%;
    padding: 0 10px 0 12px;
    background: var(--row-bg);
    overflow: hidden;
  }
  .who {
    /* never shrinks: even a fraction of a pixel of flex shrink makes Chrome
       draw an ellipsis on a name that would otherwise fit */
    flex: 0 0 auto;
    max-width: 100%;
    font-size: 13.5px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The name is the row's identity, so the instrument gives up its width
     first (and vanishes entirely) rather than clipping a musician's name. */
  .inst {
    flex: 0 1 auto;
    min-width: 0;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lane-cell { position: relative; height: 100%; }
  /* year hairlines: one painted layer per row rather than 27 more SVG nodes,
     held below the lane line so the lane always reads on top */
  .lane-cell::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      to right,
      var(--line) 0 1px,
      transparent 1px var(--year-w)
    );
    /* the gutter shifts the field's x=0, so the hairlines shift with it */
    background-position-x: var(--gutter);
    opacity: 0.55;
    pointer-events: none;
  }
  /* Nothing drawn in the lane takes the pointer except the hit targets —
     otherwise the end-cap, which sits exactly on the last mark, swallows that
     mark's hover. Clicks still reach the row: they bubble from the hit circle
     (or from .lane-cell) up to the button. */
  .lane-cell svg { position: relative; display: block; pointer-events: none; }
  .hit-band { fill: transparent; pointer-events: all; cursor: pointer; }

  .lane-tip {
    position: fixed;
    z-index: 30;
    visibility: hidden;
    pointer-events: none;
    max-width: min(420px, 92vw);
    padding: 4px 9px 5px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(28, 26, 23, 0.12);
    font-size: 12.5px;
    line-height: 1.35;
    color: var(--ink);
  }
  .lane-tip.placed { visibility: visible; }
  /* one line per session in the month — a five-session month is one dot wide,
     so the card is the only place the reader can see all five */
  .tip-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tip-line + .tip-line { margin-top: 1px; }

  @media (max-width: 620px) {
    article { padding: 26px 18px 6px; }
    h1 { font-size: 30px; }
    .field-wrap {
      --name-w: 124px;
      padding: 0 14px;
      max-width: calc(var(--name-w) + var(--field-w) + 2 * var(--gutter) + 28px);
    }
    .who { font-size: 12.5px; }
    .inst { display: none; }
  }
</style>

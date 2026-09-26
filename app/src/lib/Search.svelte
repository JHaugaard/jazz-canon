<script lang="ts">
  import { loadAlbums, loadGraph, loadDetails, loadPlaces } from './data';
  import { mixingIndex } from './mixing-query';
  import { fold, rank, styleRank } from './search-match';
  import { buildStyleIndex } from './styles';

  /* Unified search across exported musicians, albums, styles, production
     credits, and places. Each result retains its canonical ID and
     destination. */

  let {
    onOpenPerson,
    onOpenAlbum,
    onOpenMixing,
    onOpenPlace,
    onOpenStyle,
  }: {
    onOpenPerson: (personId: string) => void;
    onOpenAlbum: (albumId: string) => void;
    onOpenMixing: (role: 'producer' | 'engineer', personId: string) => void;
    onOpenPlace: (placeId: string) => void;
    onOpenStyle: (code: string) => void;
  } = $props();

  interface PersonHit {
    kind: 'person';
    id: string;
    name: string;
    norm: string;
    albums: number;
    instruments: string;
  }
  interface AlbumHit {
    kind: 'album';
    id: string;
    title: string;
    artist: string;
    year: number;
    norm: string;
  }
  interface ProductionHit {
    kind: 'production'; id: string; name: string; role: 'producer' | 'engineer'; norm: string; albums: number;
  }
  interface PlaceHit {
    kind: 'place'; id: string; name: string; placeKind: string; city: string; norm: string;
  }
  interface StyleHit {
    kind: 'style'; id: string; name: string; styleKind: 'style' | 'label'; keys: string[]; albums: number;
  }
  type Hit = PersonHit | AlbumHit | StyleHit | ProductionHit | PlaceHit;

  const MAX_PEOPLE = 7;
  const MAX_ALBUMS = 5;
  const MAX_STYLES = 5;
  const MAX_PRODUCTION = 6;
  const MAX_PLACES = 7;


  type Results = { people: PersonHit[]; albums: AlbumHit[]; styles: StyleHit[]; production: ProductionHit[]; places: PlaceHit[] };
  let index = $state<Results | null>(null);
  let supplementalError = $state(false);
  let indexPromise: Promise<void> | null = null;

  function buildIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = loadBase();
    return indexPromise;
  }

  async function loadBase() {
    const [graph, albums] = await Promise.all([loadGraph(), loadAlbums()]);
    const albumCount = new Map<string, number>();
    const instruments = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      albumCount.set(e.p, (albumCount.get(e.p) ?? 0) + 1);
      let set = instruments.get(e.p);
      if (!set) instruments.set(e.p, (set = new Set()));
      for (const en of e.entries) set.add(en.instrument);
    }
    index = {
      people: Object.entries(graph.people).map(([id, name]) => ({
        kind: 'person',
        id,
        name,
        norm: fold(name),
        albums: albumCount.get(id) ?? 0,
        instruments: [...(instruments.get(id) ?? [])].slice(0, 2).join(', '),
      })),
      production: [],
      places: [],
      styles: buildStyleIndex(albums).map((st) => ({
        kind: 'style',
        id: st.code,
        name: st.name,
        styleKind: st.kind,
        keys: st.keys,
        albums: st.primary.length + st.tagged.length,
      })),
      albums: albums.map((a) => ({
        kind: 'album',
        id: a.id,
        title: a.title,
        artist: a.artist,
        year: a.year,
        norm: fold(`${a.title} ${a.artist}`),
      })),
    };
    // New files enrich search independently; a failure cannot erase the
    // musician/album results that were already usable.
    void loadDetails().then((details) => {
      const mixing = mixingIndex(details, graph);
      index = { ...index!, production: (['producer', 'engineer'] as const).flatMap((role) =>
        [...mixing.membership[role]].map(([id, albumIds]) => ({
          kind: 'production' as const, id, role,
          name: mixing.names.get(id) ?? id, norm: fold(mixing.names.get(id) ?? id), albums: albumIds.size,
        }))) };
    }).catch(() => { supplementalError = true; });
    void loadPlaces().then((places) => {
      index = { ...index!, places: places.places.map((p) => ({
        kind: 'place', id: p.id, name: p.name, placeKind: p.kind, city: p.city, norm: fold(p.name),
      })) };
    }).catch(() => { supplementalError = true; });
  }

  let query = $state('');
  let open = $state(false);
  let active = $state(0); // index into the flat results list
  let inputEl = $state<HTMLInputElement | null>(null);
  let boxEl = $state<HTMLElement | null>(null);
  let mobileOpen = $state(false);


  let results = $derived.by((): Results => {
    const q = fold(query.trim());
    if (!q || !index) return { people: [], albums: [], styles: [], production: [], places: [] };
    const score = <T extends Exclude<Hit, StyleHit>>(hits: T[]): (T & { r: number })[] =>
      hits
        .map((h) => ({ ...h, r: rank(h.norm, q) }))
        .filter((h): h is T & { r: number } => h.r !== null);
    const people = score(index.people)
      .sort((a, b) => a.r - b.r || b.albums - a.albums || a.name.localeCompare(b.name))
      .slice(0, MAX_PEOPLE);
    const albums = score(index.albums)
      .sort((a, b) => a.r - b.r || a.year - b.year || a.title.localeCompare(b.title))
      .slice(0, MAX_ALBUMS);
    const styles = index.styles
      .map((h) => ({ ...h, r: styleRank(h.keys, query) }))
      .filter((h): h is StyleHit & { r: number } => h.r !== null)
      .sort((a, b) => a.r - b.r || b.albums - a.albums || a.name.localeCompare(b.name))
      .slice(0, MAX_STYLES);
    const production = score(index.production)
      .sort((a, b) => a.r - b.r || b.albums - a.albums || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .slice(0, MAX_PRODUCTION);
    const places = score(index.places)
      .sort((a, b) => a.r - b.r || a.name.localeCompare(b.name) || a.city.localeCompare(b.city) || a.id.localeCompare(b.id))
      .slice(0, MAX_PLACES);
    return { people, albums, styles, production, places };
  });

  let flat = $derived([...results.people, ...results.albums, ...results.styles, ...results.production, ...results.places] as Hit[]);

  $effect(() => {
    void flat.length;
    active = 0;
  });

  function choose(hit: Hit) {
    open = false;
    mobileOpen = false;
    query = '';
    inputEl?.blur();
    if (hit.kind === 'person') onOpenPerson(hit.id);
    else if (hit.kind === 'album') onOpenAlbum(hit.id);
    else if (hit.kind === 'style') onOpenStyle(hit.id);
    else if (hit.kind === 'production') onOpenMixing(hit.role, hit.id);
    else onOpenPlace(hit.id);
  }

  function onInput() {
    open = true;
  }

  /* Examples on the empty-field hint: clicking one runs it as a search. */
  const EXAMPLES = ['Coltrane', 'Blue Train', 'Hard Bop', 'Van Gelder', 'Birdland'];
  function tryExample(q: string) {
    query = q;
    open = true;
    inputEl?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation(); // don't also pop the panel stack
      if (open) {
        open = false;
      } else {
        query = '';
        mobileOpen = false;
        inputEl?.blur();
      }
      return;
    }
    if (!open || !flat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % flat.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + flat.length) % flat.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(flat[active]);
    }
  }

  // "/" focuses the search from anywhere (unless already typing somewhere)
  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
    e.preventDefault();
    mobileOpen = true;
    // the mobile input may not exist until after this state flips
    requestAnimationFrame(() => inputEl?.focus());
  }

  function onFocus() {
    buildIndex();
    open = true;
  }

  // click/tap outside closes the dropdown (and the phone search bar)
  function onWindowPointerDown(e: PointerEvent) {
    if (boxEl && !boxEl.contains(e.target as Node)) {
      open = false;
      mobileOpen = false;
    }
  }

  function openMobile() {
    buildIndex();
    mobileOpen = true;
    requestAnimationFrame(() => inputEl?.focus());
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onpointerdown={onWindowPointerDown} />

<div class="search" class:mobile-open={mobileOpen} bind:this={boxEl}>
  <button class="search-toggle" aria-label="Search" onclick={openMobile}>
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="12.8" y1="12.8" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>

  <div class="field">
    <svg class="glass" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="12.8" y1="12.8" x2="17.5" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      type="search"
      placeholder="Search the canon"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-label="Search musicians, albums, styles, places, producers and engineers"
      aria-expanded={open}
      aria-controls="search-results"
      aria-activedescendant={open && flat.length ? `search-opt-${active}` : undefined}
      bind:value={query}
      bind:this={inputEl}
      oninput={onInput}
      onfocus={onFocus}
      onkeydown={onKeydown}
    />
  </div>

  {#if open && !query.trim()}
    <div class="results hint" id="search-results">
      <p class="hint-what">Find a musician, album, style, studio or club, producer, or engineer.</p>
      <p class="hint-try">
        <span class="hint-k">Try</span>
        {#each EXAMPLES as ex, i}{#if i > 0}<span class="hint-sep" aria-hidden="true">·</span>{/if}<button class="hint-ex" onclick={() => tryExample(ex)}>{ex}</button>{/each}
      </p>
    </div>
  {:else if open}
    <div class="results" id="search-results" role="listbox" aria-label="Search results">
      {#if !flat.length}
        <div class="empty">{supplementalError ? 'Some search data could not load; musician and album results remain available.' : 'No matches in the canon.'}</div>
      {:else}
        {#if results.people.length}
          <div class="group display">Musicians</div>
          {#each results.people as hit, i (hit.id)}
            <button
              class="row"
              class:active={active === i}
              id={`search-opt-${i}`}
              role="option"
              aria-selected={active === i}
              onpointerenter={() => (active = i)}
              onclick={() => choose(hit)}
            >
              <span class="row-main">{hit.name}</span>
              <span class="row-meta">
                {#if hit.instruments}{hit.instruments}&ensp;·&ensp;{/if}{hit.albums} album{hit.albums === 1 ? '' : 's'}
              </span>
            </button>
          {/each}
        {/if}
        {#if results.albums.length}
          <div class="group display">Albums</div>
          {#each results.albums as hit, i (hit.id)}
            {@const fi = results.people.length + i}
            <button
              class="row"
              class:active={active === fi}
              id={`search-opt-${fi}`}
              role="option"
              aria-selected={active === fi}
              onpointerenter={() => (active = fi)}
              onclick={() => choose(hit)}
            >
              <span class="row-main">{hit.title}</span>
              <span class="row-meta">{hit.artist}&ensp;·&ensp;{hit.year}</span>
            </button>
          {/each}
        {/if}
        {#if results.styles.length}
          <div class="group display">Styles</div>
          {#each results.styles as hit, i (hit.id)}
            {@const fi = results.people.length + results.albums.length + i}
            <button class="row" class:active={active === fi} id={`search-opt-${fi}`} role="option"
              aria-selected={active === fi} onpointerenter={() => (active = fi)} onclick={() => choose(hit)}>
              <span class="row-main">{hit.name}</span>
              <span class="row-meta">{hit.styleKind === 'label' ? 'Record label' : 'Style'} · {hit.albums} album{hit.albums === 1 ? '' : 's'}</span>
            </button>
          {/each}
        {/if}
        {#if results.production.length}
          <div class="group display">Production credits</div>
          {#each results.production as hit, i (`${hit.role}:${hit.id}`)}
            {@const fi = results.people.length + results.albums.length + results.styles.length + i}
            <button class="row" class:active={active === fi} id={`search-opt-${fi}`} role="option"
              aria-selected={active === fi} onpointerenter={() => (active = fi)} onclick={() => choose(hit)}>
              <span class="row-main">{hit.name}</span>
              <span class="row-meta">{hit.role === 'producer' ? 'Producer' : 'Engineer'} · {hit.albums} album{hit.albums === 1 ? '' : 's'}</span>
            </button>
          {/each}
        {/if}
        {#if results.places.length}
          <div class="group display">Places</div>
          {#each results.places as hit, i (hit.id)}
            {@const fi = results.people.length + results.albums.length + results.styles.length + results.production.length + i}
            <button class="row" class:active={active === fi} id={`search-opt-${fi}`} role="option"
              aria-selected={active === fi} onpointerenter={() => (active = fi)} onclick={() => choose(hit)}>
              <span class="row-main">{hit.name}</span>
              <span class="row-meta">{hit.placeKind} · {hit.city}</span>
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .search { position: relative; flex: 0 1 380px; min-width: 0; }

  .search-toggle { display: none; }

  .field { position: relative; }
  .glass {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    width: 15px;
    height: 15px;
    color: var(--muted);
    pointer-events: none;
  }
  input {
    width: 100%;
    height: 38px;
    padding: 0 12px 0 34px;
    font-family: var(--font-body);
    font-size: var(--fs-base);
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    outline: none;
  }
  input::placeholder { color: var(--muted); opacity: 0.8; }
  input:focus { border-color: var(--bn-blue-light); background: var(--surface); }
  input::-webkit-search-cancel-button { -webkit-appearance: none; }

  .results {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-pop);
    max-height: min(480px, 70vh);
    overflow-y: auto;
    z-index: 40;
    padding: 4px;
  }
  .group {
    font-size: var(--fs-md);
    color: var(--bn-blue);
    letter-spacing: 0.06em;
    padding: 7px 10px 3px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: var(--radius);
    padding: 6px 10px;
  }
  .row.active { background: rgba(43, 95, 122, 0.09); }
  .row-main { font-size: var(--fs-md); font-weight: 600; color: var(--ink); }
  .row-meta { font-size: var(--fs-sm); color: var(--muted); }
  .empty { padding: 12px; font-size: var(--fs-md); color: var(--muted); }

  /* empty-field hint: what search covers, plus runnable examples */
  .hint { padding: 12px 14px; }
  .hint p { margin: 0; font-size: var(--fs-md); line-height: 1.5; }
  .hint-what { color: var(--ink); }
  .hint-try { margin-top: 6px !important; color: var(--muted); display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 0; }
  .hint-k { margin-right: 8px; }
  .hint-sep { margin: 0 6px; opacity: 0.6; }
  .hint-ex {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-weight: 600;
    color: var(--bn-blue);
  }
  .hint-ex:hover, .hint-ex:focus-visible { text-decoration: underline; }

  /* Phone: the field collapses to an icon; tapping it drops a full-width
     search bar under the masthead. */
  @media (max-width: 620px) {
    .search { flex: 0 0 auto; }
    .search-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: none;
      border: none;
      color: var(--bn-blue);
      padding: 0;
    }
    .search-toggle svg { width: 19px; height: 19px; }

    .field { display: none; }
    .search.mobile-open .field {
      display: block;
      position: fixed;
      top: var(--masthead-h);
      left: 0;
      right: 0;
      padding: 8px 12px;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
      z-index: 40;
    }
    .search.mobile-open .glass { left: 23px; }
    .search.mobile-open .results {
      position: fixed;
      top: calc(var(--masthead-h) + 55px);
      left: 12px;
      right: 12px;
    }
  }
</style>

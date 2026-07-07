<script lang="ts">
  import { loadAlbums, loadGraph } from './data';

  /* Unified search over the two things the canon knows: musicians and
     albums. Selecting a musician opens their Constellation; selecting an
     album opens its deep dive. The index is built once, client-side, from
     the same two JSON files the rest of the app already loads. */

  let {
    onOpenPerson,
    onOpenAlbum,
  }: {
    onOpenPerson: (personId: string) => void;
    onOpenAlbum: (albumId: string) => void;
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
  type Hit = PersonHit | AlbumHit;

  const MAX_PEOPLE = 7;
  const MAX_ALBUMS = 5;

  // diacritic-insensitive fold ("Naná" matches "nana")
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

  let index = $state<{ people: PersonHit[]; albums: AlbumHit[] } | null>(null);

  async function buildIndex() {
    if (index) return;
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
      albums: albums.map((a) => ({
        kind: 'album',
        id: a.id,
        title: a.title,
        artist: a.artist,
        year: a.year,
        norm: fold(`${a.title} ${a.artist}`),
      })),
    };
  }

  let query = $state('');
  let open = $state(false);
  let active = $state(0); // index into the flat results list
  let inputEl = $state<HTMLInputElement | null>(null);
  let boxEl = $state<HTMLElement | null>(null);
  let mobileOpen = $state(false);

  /* rank: 0 = whole string starts with the query, 1 = some word starts
     with it, 2 = substring anywhere. Lower is better. */
  function rank(norm: string, q: string): number | null {
    if (norm.startsWith(q)) return 0;
    const at = norm.indexOf(q);
    if (at < 0) return null;
    return norm[at - 1] === ' ' ? 1 : 2;
  }

  let results = $derived.by((): { people: PersonHit[]; albums: AlbumHit[] } => {
    const q = fold(query.trim());
    if (!q || !index) return { people: [], albums: [] };
    const score = <T extends Hit>(hits: T[]): (T & { r: number })[] =>
      hits
        .map((h) => ({ ...h, r: rank(h.norm, q) }))
        .filter((h): h is T & { r: number } => h.r !== null);
    const people = score(index.people)
      .sort((a, b) => a.r - b.r || b.albums - a.albums || a.name.localeCompare(b.name))
      .slice(0, MAX_PEOPLE);
    const albums = score(index.albums)
      .sort((a, b) => a.r - b.r || a.year - b.year || a.title.localeCompare(b.title))
      .slice(0, MAX_ALBUMS);
    return { people, albums };
  });

  let flat = $derived([...results.people, ...results.albums] as Hit[]);

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
    else onOpenAlbum(hit.id);
  }

  function onInput() {
    open = query.trim().length > 0;
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
    if (query.trim()) open = true;
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
      placeholder="Musician or album…"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-label="Search musicians and albums"
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

  {#if open}
    <div class="results" id="search-results" role="listbox" aria-label="Search results">
      {#if !flat.length}
        <div class="empty">No matches in the canon.</div>
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
      {/if}
    </div>
  {/if}
</div>

<style>
  .search { position: relative; flex: 0 1 340px; min-width: 0; }

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
    font-size: 13.5px;
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
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
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(28, 26, 23, 0.16);
    max-height: min(480px, 70vh);
    overflow-y: auto;
    z-index: 40;
    padding: 4px;
  }
  .group {
    font-size: 12.5px;
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
    border-radius: 6px;
    padding: 6px 10px;
  }
  .row.active { background: rgba(43, 95, 122, 0.09); }
  .row-main { font-size: 13.5px; font-weight: 600; color: var(--ink); }
  .row-meta { font-size: 12px; color: var(--muted); }
  .empty { padding: 12px; font-size: 13px; color: var(--muted); }

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

<script lang="ts">
  import { loadAlbums } from './lib/data';
  import { nav } from './lib/nav.svelte';
  import Timeline from './lib/Timeline.svelte';
  import DeepDive from './lib/DeepDive.svelte';
  import Network from './lib/Network.svelte';
  import FloatingWindow from './lib/FloatingWindow.svelte';
  import PlaceWindow from './lib/PlaceWindow.svelte';
  import About from './lib/About.svelte';
  import Working from './lib/Working.svelte';
  import Search from './lib/Search.svelte';
  import type { AlbumCard } from './lib/types';

  let albums = $state<AlbumCard[] | null>(null);
  let loadError = $state<string | null>(null);

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

  loadAlbums()
    .then((a) => (albums = a))
    .catch((e) => (loadError = String(e)));

  let byId = $derived(new Map((albums ?? []).map((a) => [a.id, a])));
  let top = $derived(nav.top);

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && nav.top) nav.back();
  }

  let constName = $state('');
  let placeName = $state('');
</script>

<svelte:window onkeydown={onKeydown} onhashchange={() => (route = parseHash())} />

<div class="shell">
  <header class="masthead">
    <!-- lockup: record mark (scaled ~1.2x) + wordmark, sharing a baseline.
         Mark is inline SVG (an <img> SVG can't fetch the Oswald webfont;
         the wordmark is live text so it uses the font the page loads). -->
    <button class="lockup" onclick={goHome} aria-label="A Jazz Canon — home">
      <svg class="mark" viewBox="10 16 320 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <clipPath id="lh-rec"><circle cx="250" cy="110" r="74"/></clipPath>
        </defs>
        <g>
          <rect x="18"  y="24" width="8" height="172" rx="2" fill="#2b5f7a"/>
          <rect x="30"  y="24" width="8" height="172" rx="2" fill="#4a7c95"/>
          <rect x="42"  y="24" width="8" height="172" rx="2" fill="#21506a"/>
          <rect x="54"  y="24" width="8" height="172" rx="2" fill="#2b5f7a"/>
          <rect x="94"  y="24" width="8" height="172" rx="2" fill="#4a7c95"/>
          <rect x="106" y="24" width="8" height="172" rx="2" fill="#21506a"/>
          <rect x="118" y="24" width="8" height="172" rx="2" fill="#2b5f7a"/>
          <rect x="130" y="24" width="8" height="172" rx="2" fill="#4a7c95"/>
          <rect x="142" y="24" width="8" height="172" rx="2" fill="#21506a"/>
        </g>
        <ellipse cx="163" cy="110" rx="13" ry="82" fill="#4a7c95"/>
        <circle cx="250" cy="110" r="74" fill="#2b5f7a"/>
        <g clip-path="url(#lh-rec)" fill="none" stroke="#faf8f3" stroke-opacity="0.5" stroke-width="2">
          <circle cx="250" cy="110" r="16"/><circle cx="250" cy="110" r="26"/><circle cx="250" cy="110" r="37"/>
          <circle cx="250" cy="110" r="47"/><circle cx="250" cy="110" r="57"/><circle cx="250" cy="110" r="68"/>
        </g>
        <circle cx="250" cy="110" r="8" fill="#c4862a"/>
        <rect x="62" y="22.9" width="8" height="172" rx="1" fill="#c4862a" transform="rotate(8 62 194.9)"/>
      </svg>
      <span class="wordmark">
        <span class="wm-title display">A Jazz Canon</span>
        <span class="wm-tag display">Jazz on Record</span>
      </span>
    </button>

    <Search
      onOpenPerson={(pid) => { go('home'); nav.openPerson(pid); }}
      onOpenAlbum={(aid) => { go('home'); nav.openAlbum(aid); }}
    />

    <nav class="mast-nav">
      <button class="nav-link" class:active={route === 'home'} onclick={goHome}>Home</button>
      <button class="nav-link" class:active={route === 'working'} onclick={() => go('working')}>Working</button>
      <button class="nav-link" class:active={route === 'about'} onclick={() => go('about')}>About</button>
    </nav>
  </header>

  <main>
    {#if route === 'about'}
      <About onopen={(id) => nav.openAlbum(id)} />
    {:else if route === 'working'}
      <Working
        onOpenPerson={(pid) => nav.openPerson(pid)}
        onOpenAlbum={(aid) => nav.openAlbum(aid)}
      />
    {:else if loadError}
      <p class="fatal">Couldn’t load the canon data ({loadError}).</p>
    {:else if !albums}
      <p class="fatal">Loading…</p>
    {:else}
      <Timeline {albums} onopen={(id) => nav.openAlbum(id)} />
    {/if}
  </main>

  {#if top?.kind === 'album'}
    <aside class="panel">
      <div class="panel-bar">
        {#if nav.stack.length > 1}
          <button class="nav-btn" onclick={() => nav.back()} aria-label="Back">← Back</button>
        {:else}
          <span></span>
        {/if}
        <button class="nav-btn" onclick={() => nav.close()} aria-label="Close panel">✕ Close</button>
      </div>
      <div class="panel-body">
        {#if byId.get(top.id)}
          <DeepDive
            album={byId.get(top.id)!}
            onOpenPerson={(pid) => nav.openPerson(pid)}
            onOpenPlace={(pid) => nav.openPlace(pid)}
          />
        {/if}
      </div>
    </aside>
  {:else if top?.kind === 'person'}
    <FloatingWindow
      variant="constellation"
      title={constName}
      guide="Click an album to open&ensp;·&ensp;click a musician to follow the thread&ensp;·&ensp;drag to rearrange&ensp;·&ensp;scroll to zoom"
      ariaLabel="Constellation"
      showBack={nav.stack.length > 1}
      onBack={() => nav.back()}
      onClose={() => nav.close()}
    >
      <Network
        personId={top.id}
        onOpenAlbum={(aid) => nav.openAlbum(aid)}
        onRecenter={(pid) => nav.openPerson(pid)}
        onmeta={(m) => (constName = m.name)}
      />
    </FloatingWindow>
  {:else if top?.kind === 'place'}
    <FloatingWindow
      variant="place"
      title={placeName}
      guide="Every canon album recorded here, oldest first&ensp;·&ensp;click one to open"
      ariaLabel="Place"
      showBack={nav.stack.length > 1}
      onBack={() => nav.back()}
      onClose={() => nav.close()}
    >
      <PlaceWindow
        placeId={top.id}
        onOpenAlbum={(aid) => nav.openAlbum(aid)}
        onmeta={(m) => (placeName = m.name)}
      />
    </FloatingWindow>
  {/if}
</div>

<style>
  .shell {
    --masthead-h: 116px;
    height: 100vh;
    height: 100dvh; /* avoids mobile browser-chrome clipping */
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .masthead {
    flex: 0 0 var(--masthead-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 0 26px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    z-index: 10;
  }

  /* lockup: mark + wordmark on a shared baseline */
  .lockup {
    display: flex;
    align-items: flex-end;
    gap: 15px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .mark { height: 80px; display: block; }
  .wordmark { display: flex; flex-direction: column; line-height: 1; padding-bottom: 4px; }
  .wm-title {
    font-size: 30px;
    color: var(--bn-blue);
    letter-spacing: 0.03em;
    line-height: 1;
  }
  .wm-tag {
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 0.2em;
    line-height: 1;
    margin-top: 5px;
  }

  .mast-nav { display: flex; gap: 6px; align-items: center; }
  .nav-link {
    background: none;
    border: none;
    font-family: var(--font-display);
    font-variant: small-caps;
    font-size: 17px;
    letter-spacing: 0.04em;
    color: var(--muted);
    padding: 6px 12px;
    border-radius: 6px;
  }
  .nav-link:hover { color: var(--bn-blue); background: var(--bg); }
  .nav-link.active { color: var(--bn-blue); }
  .nav-link.active::after {
    content: '';
    display: block;
    height: 2px;
    background: var(--impulse-amber);
    margin-top: 2px;
    border-radius: 2px;
  }

  main { flex: 1; min-height: 0; }
  .fatal { padding: 30px; color: var(--muted); }

  .panel {
    position: absolute;
    top: var(--masthead-h);
    right: 0;
    bottom: 0;
    width: min(520px, 94vw);
    background: var(--surface);
    border-left: 1px solid var(--line);
    box-shadow: -10px 0 30px rgba(28, 26, 23, 0.12);
    display: flex;
    flex-direction: column;
    z-index: 20;
    animation: slide-in 200ms ease-out;
  }

  @keyframes slide-in {
    from { transform: translateX(40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  /* ---- Responsive ---------------------------------------------------- */
  /* iPad portrait & small laptops: trim the masthead, keep everything else */
  @media (max-width: 1024px) {
    .shell { --masthead-h: 92px; }
    .mark { height: 62px; }
    .wm-title { font-size: 25px; }
    .wm-tag { font-size: 11px; margin-top: 4px; }
    .nav-link { font-size: 16px; }
    .masthead { padding: 0 18px; }
  }

  /* Phone: compact header, panels take the full width */
  @media (max-width: 620px) {
    .shell { --masthead-h: 66px; }
    .mark { height: 44px; }
    .wm-title { font-size: 19px; letter-spacing: 0.02em; }
    .wm-tag { display: none; }
    .lockup { gap: 10px; align-items: center; }
    .nav-link { font-size: 15px; padding: 6px 9px; }
    .masthead { padding: 0 12px; }

    .panel { width: 100vw; }
  }
</style>

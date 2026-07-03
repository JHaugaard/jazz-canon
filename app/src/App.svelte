<script lang="ts">
  import { loadAlbums } from './lib/data';
  import { nav } from './lib/nav.svelte';
  import Timeline from './lib/Timeline.svelte';
  import DeepDive from './lib/DeepDive.svelte';
  import Network from './lib/Network.svelte';
  import About from './lib/About.svelte';
  import type { AlbumCard } from './lib/types';

  let albums = $state<AlbumCard[] | null>(null);
  let loadError = $state<string | null>(null);
  let view = $state<'timeline' | 'about'>('timeline');

  function goHome() {
    view = 'timeline';
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

  // Constellation window drag (grab the title bar). Once dragged, the
  // window keeps explicit coordinates; until then CSS centers it.
  let winPos = $state<{ x: number; y: number } | null>(null);
  let winSize = $state<{ w: number; h: number } | null>(null);
  let winEl = $state<HTMLElement | null>(null);
  let winDrag: { dx: number; dy: number } | null = null;
  let constName = $state('');

  function winDown(e: PointerEvent) {
    if (!winEl || (e.target as HTMLElement).closest('button')) return;
    const r = winEl.getBoundingClientRect();
    winDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function winMove(e: PointerEvent) {
    if (!winDrag || !winEl) return;
    const w = winEl.offsetWidth;
    winPos = {
      x: Math.min(Math.max(e.clientX - winDrag.dx, 8 - w * 0.6), window.innerWidth - 60),
      y: Math.min(Math.max(e.clientY - winDrag.dy, 0), window.innerHeight - 60),
    };
  }
  function winUp() {
    winDrag = null;
  }

  // Constellation window resize (grab the bottom-right grip). Move/up are
  // handled at the window level so a fast drag off the 20px grip keeps working.
  let winResize: { x: number; y: number; w: number; h: number } | null = null;
  function resizeDown(e: PointerEvent) {
    if (!winEl) return;
    e.stopPropagation();
    e.preventDefault();
    const r = winEl.getBoundingClientRect();
    winResize = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
  }
  function onWindowPointerMove(e: PointerEvent) {
    if (!winResize) return;
    winSize = {
      w: Math.max(560, Math.min(window.innerWidth - 20, winResize.w + (e.clientX - winResize.x))),
      h: Math.max(420, Math.min(window.innerHeight - 20, winResize.h + (e.clientY - winResize.y))),
    };
  }
  function onWindowPointerUp() {
    winResize = null;
  }
</script>

<svelte:window onkeydown={onKeydown} onpointermove={onWindowPointerMove} onpointerup={onWindowPointerUp} />

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

    <nav class="mast-nav">
      <button class="nav-link" class:active={view === 'timeline'} onclick={goHome}>Home</button>
      <button class="nav-link" class:active={view === 'about'} onclick={() => (view = 'about')}>About</button>
    </nav>
  </header>

  <main>
    {#if view === 'about'}
      <About onopen={(id) => nav.openAlbum(id)} />
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
          <DeepDive album={byId.get(top.id)!} onOpenPerson={(pid) => nav.openPerson(pid)} />
        {/if}
      </div>
    </aside>
  {:else if top?.kind === 'person'}
    <section
      class="constellation"
      class:free={winPos !== null}
      style:left={winPos ? `${winPos.x}px` : undefined}
      style:top={winPos ? `${winPos.y}px` : undefined}
      style:width={winSize ? `${winSize.w}px` : undefined}
      style:height={winSize ? `${winSize.h}px` : undefined}
      bind:this={winEl}
      aria-label="Constellation"
    >
      <div
        class="panel-bar win-bar"
        role="toolbar"
        tabindex="-1"
        aria-label="Constellation window bar (drag to move)"
        onpointerdown={winDown}
        onpointermove={winMove}
        onpointerup={winUp}
        onpointercancel={winUp}
      >
        <span class="win-name">
          <span class="win-title display">{constName}</span>
          <span class="win-guide">Click an album to open&ensp;·&ensp;click a musician to follow the thread&ensp;·&ensp;drag to rearrange&ensp;·&ensp;scroll to zoom</span>
        </span>
        <span class="win-actions">
          {#if nav.stack.length > 1}
            <button class="nav-btn" onclick={() => nav.back()} aria-label="Back">← Back</button>
          {/if}
          <button class="nav-btn" onclick={() => nav.close()} aria-label="Close Constellation">✕ Close</button>
        </span>
      </div>
      <div class="panel-body">
        <Network
          personId={top.id}
          onOpenAlbum={(aid) => nav.openAlbum(aid)}
          onRecenter={(pid) => nav.openPerson(pid)}
          onmeta={(m) => (constName = m.name)}
        />
      </div>
      <div
        class="resize-grip"
        role="button"
        tabindex="-1"
        aria-label="Resize Constellation"
        title="Drag to resize"
        onpointerdown={resizeDown}
      ></div>
    </section>
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

  /* Constellation: a large draggable, resizable window over the timeline */
  .constellation {
    position: absolute;
    left: 50%;
    top: calc(var(--masthead-h) + 1.5vh);
    transform: translateX(-50%);
    width: min(1640px, 97vw);
    /* fit within the space below the masthead so the resize grip and
       bottom edge always stay on-screen */
    height: min(1160px, calc(100vh - var(--masthead-h) - 4vh));
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 18px 50px rgba(28, 26, 23, 0.22);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 20;
    animation: slide-in 200ms ease-out;
  }
  .constellation.free { transform: none; }
  .win-bar {
    cursor: grab;
    user-select: none;
    touch-action: none;
    align-items: flex-start;
    padding: 14px 40px;
  }
  .win-bar:active { cursor: grabbing; }
  .win-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .win-title {
    font-size: 26px;
    line-height: 1.05;
    color: var(--ink);
    letter-spacing: 0.02em;
  }
  .win-guide { font-size: 12.5px; color: var(--muted); }
  .win-actions { display: flex; gap: 8px; flex: 0 0 auto; padding-top: 2px; }

  .resize-grip {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    touch-action: none;
    background:
      linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 62%,
        transparent 62%, transparent 74%, var(--bn-blue-light) 74%, var(--bn-blue-light) 86%, transparent 86%);
    border-bottom-right-radius: 10px;
  }

  @keyframes slide-in {
    from { transform: translateX(40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .panel-bar {
    flex: 0 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }
  .nav-btn {
    background: none;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--bn-blue);
  }
  .nav-btn:hover { border-color: var(--bn-blue-light); background: var(--surface); }

  .panel-body { flex: 1; overflow-y: auto; min-height: 0; }

  /* ---- Responsive ---------------------------------------------------- */
  /* iPad portrait & small laptops: trim the masthead, keep everything else */
  @media (max-width: 1024px) {
    .shell { --masthead-h: 92px; }
    .mark { height: 62px; }
    .wm-title { font-size: 25px; }
    .wm-tag { font-size: 11px; margin-top: 4px; }
    .nav-link { font-size: 16px; }
    .masthead { padding: 0 18px; }
    .constellation { width: 96vw; height: min(1100px, calc(100dvh - var(--masthead-h) - 3vh)); }
  }

  /* Phone: compact header, panels take the full width, Constellation goes
     full-screen (dragging/resizing a floating window isn't useful here) */
  @media (max-width: 620px) {
    .shell { --masthead-h: 66px; }
    .mark { height: 44px; }
    .wm-title { font-size: 19px; letter-spacing: 0.02em; }
    .wm-tag { display: none; }
    .lockup { gap: 10px; align-items: center; }
    .nav-link { font-size: 15px; padding: 6px 9px; }
    .masthead { padding: 0 12px; }

    .panel { width: 100vw; }

    .constellation {
      left: 0; right: 0; top: var(--masthead-h);
      transform: none;
      width: 100vw;
      height: calc(100dvh - var(--masthead-h));
      border: none; border-radius: 0;
    }
    .win-bar { padding: 10px 16px; }
    .win-guide { display: none; }
    .resize-grip { display: none; }
  }
</style>

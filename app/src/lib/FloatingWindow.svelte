<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant,
    title,
    guide = '',
    ariaLabel,
    showBack = false,
    onBack,
    onClose,
    children,
  }: {
    variant: 'constellation' | 'place';
    title: string;
    guide?: string;
    ariaLabel: string;
    showBack?: boolean;
    onBack: () => void;
    onClose: () => void;
    children: Snippet;
  } = $props();

  // Window drag (grab the title bar). Once dragged, the window keeps
  // explicit coordinates; until then CSS centers it.
  let winPos = $state<{ x: number; y: number } | null>(null);
  let winSize = $state<{ w: number; h: number } | null>(null);
  let winEl = $state<HTMLElement | null>(null);
  let winDrag: { dx: number; dy: number } | null = null;

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

  // Resize (grab the bottom-right grip). Move/up are handled at the window
  // level so a fast drag off the 20px grip keeps working.
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

<svelte:window onpointermove={onWindowPointerMove} onpointerup={onWindowPointerUp} />

<section
  class="fw {variant}"
  class:free={winPos !== null}
  style:left={winPos ? `${winPos.x}px` : undefined}
  style:top={winPos ? `${winPos.y}px` : undefined}
  style:width={winSize ? `${winSize.w}px` : undefined}
  style:height={winSize ? `${winSize.h}px` : undefined}
  bind:this={winEl}
  aria-label={ariaLabel}
>
  <div
    class="panel-bar win-bar"
    role="toolbar"
    tabindex="-1"
    aria-label="{ariaLabel} window bar (drag to move)"
    onpointerdown={winDown}
    onpointermove={winMove}
    onpointerup={winUp}
    onpointercancel={winUp}
  >
    <span class="win-name">
      <span class="win-title display">{title}</span>
      <!-- guide is trusted author-literal markup only — never interpolate data (it is the codebase's only {@html}). -->
      {#if guide}<span class="win-guide">{@html guide}</span>{/if}
    </span>
    <span class="win-actions">
      {#if showBack}
        <button class="nav-btn" onclick={onBack} aria-label="Back">← Back</button>
      {/if}
      <button class="nav-btn" onclick={onClose} aria-label="Close {ariaLabel}">✕ Close</button>
    </span>
  </div>
  <div class="panel-body">
    {@render children()}
  </div>
  <div
    class="resize-grip"
    role="button"
    tabindex="-1"
    aria-label="Resize window"
    title="Drag to resize"
    onpointerdown={resizeDown}
  ></div>
</section>

<style>
  /* A large draggable, resizable window over the timeline. Defaults are
     the Constellation's original numbers — behavior-preserving. */
  .fw {
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
  .fw.free { transform: none; }

  /* Place window: same chrome, list-sized frame */
  .fw.place {
    width: min(760px, 96vw);
    height: min(900px, calc(100vh - var(--masthead-h) - 4vh));
  }

  /* The bar's box (padding, alignment, background, border) comes from the
     shared .panel-bar rule in app.css; only the drag affordances are added
     here. Note that .panel-bar also governs padding/align-items on desktop —
     the pre-refactor code declared 14px 40px / flex-start here, but those
     never applied (.panel-bar was declared later at equal specificity), so
     they are deliberately not carried over. */
  .win-bar {
    cursor: grab;
    user-select: none;
    touch-action: none;
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

  @media (max-width: 1024px) {
    .fw { width: 96vw; height: min(1100px, calc(100dvh - var(--masthead-h) - 3vh)); }
    .fw.place { width: min(760px, 96vw); height: min(900px, calc(100dvh - var(--masthead-h) - 3vh)); }
  }

  /* Phone: full-screen (dragging/resizing a floating window isn't useful) */
  @media (max-width: 620px) {
    .fw,
    .fw.place {
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

<script lang="ts">
  import type { AlbumCard } from './types';
  import { computeLayout, eraLane, ERA_BANDS, CARD_H, CARD_GAP } from './timeline-layout';
  import AlbumCardTile from './AlbumCardTile.svelte';

  let { albums, onopen }: { albums: AlbumCard[]; onopen: (id: string) => void } = $props();

  // Year axis sits at the TOP (the bottom of the window is reserved for
  // future info surfaces). Bands and cards start below it.
  const AXIS_H = 36;
  const CONTENT_TOP = AXIS_H + 8;

  let areaHeight = $state(600);

  // Cards per vertical stack, adapted to viewport height (min 2, max 4).
  let perColumn = $derived(
    Math.max(2, Math.min(4, Math.floor((areaHeight - CONTENT_TOP - 18) / (CARD_H + CARD_GAP))))
  );
  let layout = $derived(computeLayout(albums, perColumn));

  // drag-to-pan (mouse); native scroll covers trackpads/touch
  let scroller: HTMLDivElement;
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartScroll = 0;
  let moved = false;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true;
    moved = false;
    dragStartX = e.clientX;
    dragStartScroll = scroller.scrollLeft;
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 4) moved = true;
    scroller.scrollLeft = dragStartScroll - dx;
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    // swallow the click that follows a real drag so cards don't open
    if (moved) {
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      scroller.addEventListener('click', swallow, { capture: true, once: true });
    }
  }

  // start the view in the late 1950s, the canon's center of gravity
  $effect(() => {
    if (scroller && layout.totalWidth > 0) {
      const target = layout.xOfYear(1957) - 80;
      scroller.scrollLeft = Math.max(0, target);
    }
  });

  // a plain vertical mouse wheel pans the timeline horizontally (trackpads
  // already produce deltaX and keep their native behavior). Registered
  // manually: wheel listeners added via markup are passive, and this one
  // must preventDefault.
  $effect(() => {
    if (!scroller) return;
    const el = scroller;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.deltaY === 0 || e.ctrlKey) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
</script>

<div
  class="scroller"
  class:dragging
  role="region"
  aria-label="Album timeline, 1949 to 1972"
  bind:this={scroller}
  bind:clientHeight={areaHeight}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={() => (dragging = false)}
>
  <div class="canvas" style:width="{layout.totalWidth}px">
    <!-- year axis (top) -->
    <div class="axis" style:height="{AXIS_H}px">
      {#each layout.years as yb}
        <div class="tick" style:left="{yb.x0}px" style:width="{yb.width}px">
          <span class="tick-mark"></span>
          <span class="tick-label display" class:empty={yb.count === 0}>{yb.count > 0 ? yb.year : `’${String(yb.year).slice(2)}`}</span>
        </div>
      {/each}
    </div>

    <!-- era bands: overlapping lanes behind everything -->
    <div class="bands" style:top="{CONTENT_TOP}px" style:bottom="12px">
      {#each ERA_BANDS as band, i}
        {@const lane = eraLane(i, ERA_BANDS.length)}
        <div
          class="band"
          style:left="{layout.xOfYear(band.from)}px"
          style:width="{layout.xOfYear(band.to + 1) - layout.xOfYear(band.from)}px"
          style:top="{lane.top}%"
          style:height="{lane.height}%"
          style:background={band.cssVar}
        ></div>
      {/each}
    </div>

    <!-- era labels: own layer above the cards so they stay readable at any
         scroll position (sticky within each band's horizontal span) -->
    <div class="band-labels" style:top="{CONTENT_TOP}px" style:bottom="12px">
      {#each ERA_BANDS as band, i}
        {@const lane = eraLane(i, ERA_BANDS.length)}
        <div
          class="band-label-track"
          style:left="{layout.xOfYear(band.from)}px"
          style:width="{layout.xOfYear(band.to + 1) - layout.xOfYear(band.from)}px"
          style:top="{lane.labelTop}%"
        >
          <span class="band-chip">
            <span class="band-label display">{band.name}</span>
            <span class="band-years">{band.from}–{band.to}</span>
          </span>
        </div>
      {/each}
    </div>

    <!-- album cards -->
    <div class="cards" style:top="{CONTENT_TOP + 12}px">
      {#each layout.cards as pc (pc.album.id)}
        <div class="slot" style:left="{pc.x}px" style:top="{pc.y}px">
          <AlbumCardTile album={pc.album} {onopen} />
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .scroller {
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    cursor: grab;
  }
  .scroller.dragging { cursor: grabbing; user-select: none; }
  .canvas {
    position: relative;
    height: 100%;
    min-width: 100%;
  }

  .bands { position: absolute; left: 0; right: 0; z-index: 0; }
  .band { position: absolute; border-radius: 8px; }

  .band-labels {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 3;
    pointer-events: none;
  }
  .band-label-track {
    position: absolute;
    white-space: nowrap;
    padding-top: 6px;
  }
  .band-chip {
    /* sticky: stays readable at any horizontal scroll position while its
       band is in view. Solid paper + border + shadow so that where it rides
       over a card it reads as a pinned map label, not a text collision. */
    position: sticky;
    left: 12px;
    display: inline-flex;
    align-items: baseline;
    gap: 7px;
    background: var(--bg);
    border: 1px solid var(--line);
    box-shadow: 0 2px 6px rgba(28, 26, 23, 0.1);
    border-radius: 5px;
    padding: 2px 9px 3px;
  }
  .band-label {
    font-size: 15px;
    color: var(--era-ink);
  }
  .band-years {
    font-size: 11px;
    color: var(--era-ink);
    opacity: 0.75;
  }

  .axis {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
    z-index: 2;
  }
  .tick { position: absolute; top: 0; height: 100%; }
  .tick-mark {
    position: absolute;
    left: 0;
    bottom: -4px;
    width: 1px;
    height: 8px;
    background: var(--muted);
    opacity: 0.5;
  }
  .tick-label {
    position: absolute;
    left: 8px;
    top: 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .tick-label.empty { opacity: 0.55; font-size: 11.5px; top: 10px; }

  .cards { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; }
  .slot { position: absolute; }
</style>

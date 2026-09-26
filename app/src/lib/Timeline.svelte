<script lang="ts">
  import { untrack } from 'svelte';
  import type { AlbumCard } from './types';
  import { computeLayout, eraLanes, ERA_BANDS, CARD_H, CARD_GAP, START_YEAR, END_YEAR, OPEN_YEAR } from './timeline-layout';
  import AlbumCardTile from './AlbumCardTile.svelte';

  let { albums, onopen }: { albums: AlbumCard[]; onopen: (id: string) => void } = $props();

  // Year axis sits at the TOP (the bottom of the window is reserved for
  // future info surfaces). Under the year labels runs the era ribbon: one
  // thin rule per era, packed into parallel lanes where eras coexist.
  const YEAR_ROW_H = 24;
  const LANE_H = 13;
  const lanes = eraLanes();
  const laneCount = Math.max(...lanes) + 1;
  const AXIS_H = YEAR_ROW_H + laneCount * LANE_H + 4;
  const CONTENT_TOP = AXIS_H + 2;
  const CARDS_PAD_TOP = 10; // axis rule to first row of covers
  const CARDS_PAD_BOTTOM = 4; // last row to the window edge

  let areaHeight = $state(600);

  // A short window gets one complete row rather than a clipped second row.
  // n rows need n cards and n-1 gaps, so the last row is not charged a gap
  // (the old formula charged one, and lost a row a few pixels early).
  let perColumn = $derived(
    Math.max(1, Math.min(4, Math.floor(
      (areaHeight - CONTENT_TOP - CARDS_PAD_TOP - CARDS_PAD_BOTTOM + CARD_GAP) / (CARD_H + CARD_GAP)
    )))
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

  // Preserve the semantic year position when a height change restacks cards
  // and changes year widths. Keeping raw scrollLeft would jump across years.
  let previousLayout: ReturnType<typeof computeLayout> | null = null;
  $effect(() => {
    const next = layout;
    if (!scroller || next.totalWidth <= 0) return;
    untrack(() => {
      if (!previousLayout) {
        const year = next.years.find((block) => block.year === OPEN_YEAR);
        if (year) scroller.scrollLeft = Math.max(0, year.x0 + year.width / 2 - scroller.clientWidth / 2);
      } else if (previousLayout !== next && scroller.scrollLeft > 0) {
        const center = scroller.scrollLeft + scroller.clientWidth / 2;
        const oldYear = previousLayout.years.find((year) => center >= year.x0 && center < year.x0 + year.width);
        const newYear = next.years.find((year) => year.year === oldYear?.year);
        if (oldYear && newYear) {
          const fraction = (center - oldYear.x0) / oldYear.width;
          scroller.scrollLeft = Math.max(0, newYear.x0 + fraction * newYear.width - scroller.clientWidth / 2);
        }
      }
      previousLayout = next;
    });
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
  aria-label={`Album timeline, ${START_YEAR} to ${END_YEAR}`}
  bind:this={scroller}
  bind:clientHeight={areaHeight}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={() => (dragging = false)}
>
  <div class="canvas" style:width="{layout.totalWidth}px">
    <!-- year axis (top): year labels, then the era ribbon -->
    <div class="axis" style:height="{AXIS_H}px">
      {#each layout.years as yb}
        <div class="tick" style:left="{yb.x0}px" style:width="{yb.width}px">
          <span class="tick-mark"></span>
          <span class="tick-label display" class:empty={yb.count === 0}>{yb.count > 0 ? yb.year : `’${String(yb.year).slice(2)}`}</span>
        </div>
      {/each}
      {#each ERA_BANDS as band, i}
        <div
          class="era"
          style:left="{layout.xOfYear(band.from)}px"
          style:width="{layout.xOfYear(band.to + 1) - layout.xOfYear(band.from)}px"
          style:top="{YEAR_ROW_H + lanes[i] * LANE_H}px"
          style:height="{LANE_H}px"
          style:--era={band.cssVar}
        >
          <!-- sticky: the name rides along while its era is in view -->
          <span class="era-label"><span class="era-name">{band.name}</span> <span class="era-years">{band.from}–{band.to}</span></span>
        </div>
      {/each}
    </div>

    <!-- album cards -->
    <div class="cards" style:top="{CONTENT_TOP + CARDS_PAD_TOP}px">
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
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--muted);
    opacity: 0.18;
  }
  /* sticky like the era names: with no year printed on the covers, the
     year in view must always be readable, even when its block started
     off-screen to the left */
  .tick-label {
    position: sticky;
    left: 8px;
    display: inline-block;
    margin-left: 8px;
    padding-top: 4px;
    font-size: var(--fs-md);
    color: var(--muted);
  }
  .tick-label.empty { opacity: 0.55; font-size: var(--fs-xs); padding-top: 6px; }

  /* era ribbon: a 2px rule in the era's hue, name pinned over its left end */
  .era { position: absolute; }
  .era::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    background: var(--era);
  }
  .era-label {
    position: sticky;
    left: 8px;
    display: inline-block;
    padding: 0 7px 0 6px;
    background: var(--bg);
    font-size: var(--fs-sm);
    line-height: 13px;
    white-space: nowrap;
  }
  .era-name { font-weight: 600; color: var(--era); }
  .era-years { color: var(--muted); font-size: var(--fs-xs); font-variant-numeric: tabular-nums; }

  .cards { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; }
  .slot { position: absolute; }
</style>

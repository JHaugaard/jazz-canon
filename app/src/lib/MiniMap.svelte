<script lang="ts">
  import type { AlbumPlace } from './places-data';
  import { DEV } from './places-data';
  import type { Basemap, BasemapRegion } from './places-geo';
  import {
    fitBbox, project, pinsBbox, expandBbox, ensureMinExtent, metroExtent,
    chooseRegion, ringPath, linePath, spreadPins,
  } from './places-geo';

  let {
    entries,
    basemap,
    onOpenPlace,
  }: {
    entries: AlbumPlace[];
    basemap: Basemap;
    onOpenPlace: (placeId: string) => void;
  } = $props();

  /* Fixed internal coordinate space, ~16:10; the SVG scales with the card. */
  const VP = { width: 640, height: 400 };
  const ASPECT = VP.width / VP.height;

  const pins = $derived(entries.map((e) => ({ lon: e.place.lon, lat: e.place.lat })));

  /* Extent: multi-pin → padded bbox with a 60 km floor; single pin → fixed
     metro window, doubled when the location is only city-grade (a soft
     location never gets a tight frame). */
  const extent = $derived(
    pins.length > 1
      ? ensureMinExtent(expandBbox(pinsBbox(pins), 0.25), 60, ASPECT)
      : metroExtent(pins[0], entries[0].place.precision === 'city' ? 120 : 60, ASPECT),
  );

  const region = $derived<BasemapRegion | null>(chooseRegion(pins, basemap.regions));
  const t = $derived(fitBbox(extent, VP, 24));

  $effect(() => {
    if (region === null && DEV) {
      for (const e of entries)
        console.warn(
          `basemap: no region covers "${e.place.id}" (${e.place.lat}, ${e.place.lon}) — pin on paper; extend scripts/build-basemap.mjs deliberately`,
        );
    }
  });

  interface PinView {
    place: AlbumPlace['place'];
    x: number;
    y: number;
    labelBelow: boolean;
  }
  const pinViews = $derived.by<PinView[]>(() => {
    const raw = entries.map((e) => project({ lon: e.place.lon, lat: e.place.lat }, t));
    const spread = spreadPins(raw, 14);
    /* Label collision: labels default to the pin's right; when two pins sit
       close in y and near in x, the later one's label drops below its pin.
       Offset labels — never drop a pin. */
    const views = entries.map((e, i) => ({
      place: e.place,
      x: spread[i].x,
      y: spread[i].y,
      labelBelow: false,
    }));
    const byY = [...views].sort((a, b) => a.y - b.y);
    for (let i = 1; i < byY.length; i++) {
      const a = byY[i - 1], b = byY[i];
      if (Math.abs(a.y - b.y) < 14 && Math.abs(a.x - b.x) < 110) b.labelBelow = true;
    }
    return views;
  });

  const venueKinds = new Set(['club', 'hall', 'festival']);
  function keyActivate(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenPlace(id);
    }
  }
</script>

<figure class="minimap">
  <svg viewBox="0 0 {VP.width} {VP.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of recording places">
    <!-- water ground; land paints paper over it -->
    <rect width={VP.width} height={VP.height} class="water" />
    {#if region}
      <g>
        {#each region.land as ring}<path d={ringPath(ring, t)} class="land" />{/each}
        {#each region.lakes as ring}<path d={ringPath(ring, t)} class="lake" />{/each}
        {#each region.borders as line}<path d={linePath(line, t)} class="border" />{/each}
      </g>
    {:else}
      <!-- coverage honesty: no basemap region — pins on the paper background -->
      <rect width={VP.width} height={VP.height} class="paper" />
    {/if}
    {#each pinViews as pv (pv.place.id)}
      <!-- Pins are click targets with matching aria-labels; the caption
           below is the keyboard/screen-reader path. -->
      <g
        class="pin"
        role="button"
        tabindex="-1"
        aria-label={pv.place.name}
        onclick={() => onOpenPlace(pv.place.id)}
        onkeydown={(e) => keyActivate(e, pv.place.id)}
      >
        {#if pv.place.precision === 'city'}
          <!-- soft halo: located to city level -->
          <circle cx={pv.x} cy={pv.y} r="14" class="halo" />
          <circle cx={pv.x} cy={pv.y} r="4" class="halo-core {venueKinds.has(pv.place.kind) ? 'venue' : 'studio'}" />
        {:else if venueKinds.has(pv.place.kind)}
          <!-- venue glyph: diamond -->
          <path
            d="M {pv.x} {pv.y - 6.5} L {pv.x + 6.5} {pv.y} L {pv.x} {pv.y + 6.5} L {pv.x - 6.5} {pv.y} Z"
            class="dot venue"
          />
        {:else if pv.place.kind === 'other'}
          <circle cx={pv.x} cy={pv.y} r="4.5" class="dot other" />
        {:else}
          <!-- studio/home: exact dot -->
          <circle cx={pv.x} cy={pv.y} r="5.5" class="dot studio" />
        {/if}
        <text
          class="label display"
          x={pv.labelBelow ? pv.x : pv.x + 10}
          y={pv.labelBelow ? pv.y + 20 : pv.y + 4}
          text-anchor={pv.labelBelow ? 'middle' : 'start'}
        >{pv.place.name}</text>
      </g>
    {/each}
  </svg>
  <figcaption>
    {#each entries as e, i (e.place.id)}
      {#if i > 0}<span class="sep">·</span>{/if}
      <button class="place-link" onclick={() => onOpenPlace(e.place.id)}>{e.place.name}</button>
    {/each}
  </figcaption>
</figure>

<style>
  .minimap { margin: 6px 0 2px; }
  svg {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }

  /* site palette only: water in the blue family, land as paper, muted
     coastlines and borders. Light scheme; first-render values — refined
     at the visual gate with John. */
  .water { fill: rgba(43, 95, 122, 0.12); }
  .paper { fill: var(--bg); }
  .land { fill: #f3eee2; stroke: rgba(43, 95, 122, 0.35); stroke-width: 0.8; }
  .lake { fill: rgba(43, 95, 122, 0.12); stroke: rgba(43, 95, 122, 0.25); stroke-width: 0.6; }
  .border { fill: none; stroke: #d4cbba; stroke-width: 0.8; }

  .pin { cursor: pointer; }
  .dot.studio { fill: var(--bn-blue); stroke: var(--surface); stroke-width: 1.5; }
  .dot.venue { fill: var(--impulse-amber); stroke: var(--surface); stroke-width: 1.5; }
  .dot.other { fill: var(--era-ink); stroke: var(--surface); stroke-width: 1.5; }
  .halo { fill: rgba(43, 95, 122, 0.18); }
  .halo-core.studio { fill: rgba(43, 95, 122, 0.65); }
  .halo-core.venue { fill: rgba(196, 134, 42, 0.75); }

  .label {
    font-variant: small-caps;
    font-size: 13px;
    letter-spacing: 0.04em;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--surface);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  figcaption { margin-top: 5px; font-size: 12.5px; color: var(--muted); line-height: 1.6; }
  .place-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--bn-blue);
  }
  .place-link:hover { text-decoration: underline; color: var(--bn-blue-light); }
  .sep { margin: 0 5px; opacity: 0.6; }
</style>

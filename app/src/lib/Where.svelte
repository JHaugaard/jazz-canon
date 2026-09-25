<script lang="ts">
  import { loadAlbums, loadPlaces } from './data';
  import FollowDates from './FollowDates.svelte';
  import { buildWhereData, recordingMonthOffset } from './where-data';
  import type { DateGroup, WhereData, WhereRow } from './where-data';
  import type { AlbumCard, PlaceKind } from './types';

  let {
    onOpenPlace,
    onOpenAlbum,
  }: { onOpenPlace: (placeId: string) => void; onOpenAlbum: (albumId: string) => void } = $props();

  /* A 24px month pitch keeps adjacent-month 24px pointer targets from
     overlapping. The visual dots stay small; the field is intentionally a
     long, slideable window. */
  const PX_PER_MONTH = 24;
  const PX_PER_YEAR = PX_PER_MONTH * 12;
  const ROW_H = 42;
  const GUTTER = 8;
  const xm = (months: number) => GUTTER + months * PX_PER_MONTH;

  const kindLabel: Record<PlaceKind, string> = {
    studio: 'Studio',
    club: 'Club',
    home: 'Home studio',
    hall: 'Concert hall',
    festival: 'Festival',
    other: 'Venue',
  };

  let data = $state<WhereData | null>(null);
  let albums = $state<Map<string, AlbumCard>>(new Map());
  let albumCount = $state(0);
  let loadError = $state<string | null>(null);
  let lanesScroll = $state<HTMLElement | null>(null);
  let inspectingMark = $state(false);

  Promise.all([loadPlaces(), loadAlbums()])
    .then(([places, albumList]) => {
      data = buildWhereData(places.places);
      albums = new Map(albumList.map((album) => [album.id, album]));
      albumCount = albumList.length;
    })
    .catch((error) => (loadError = String(error)));

  let years = $derived.by(() => {
    if (!data) return [];
    return Array.from({ length: data.yearEnd - data.yearStart + 1 }, (_, index) => data!.yearStart + index);
  });
  let fieldW = $derived(years.length * PX_PER_YEAR);
  let svgW = $derived(fieldW + GUTTER * 2);

  function rowHeight(row: WhereRow): number {
    const depth = Math.max(1, ...row.groups.map((group) => group.laneCount));
    return Math.max(ROW_H, depth * 24 + 4);
  }

  function groupY(group: DateGroup, row: WhereRow): number {
    const centre = rowHeight(row) / 2;
    return centre + (group.laneIndex - (group.laneCount - 1) / 2) * 24;
  }

  function formatDate(date: string): string {
    if (date.length === 4) return date;
    const [year, month, day] = date.split('-').map(Number);
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
    return day ? `${monthName} ${day}, ${year}` : `${monthName} ${year}`;
  }

  function albumName(albumId: string): string {
    return albums.get(albumId)?.title ?? albumId;
  }

  function eventLabel(row: WhereRow, group: DateGroup): string {
    const precision = row.place.precision === 'city' ? ', location known to city level' : '';
    const album = albums.get(group.events[0].albumId);
    const identity = album ? `${album.title}, ${album.artist}` : group.events[0].albumId;
    return `${identity}, recorded at ${row.place.name} on ${formatDate(group.date)}${precision}`;
  }
</script>

<div class="where">
  <article>
    <h1 class="display">Where</h1>
    <p class="intro">
      Follow the rooms where this canon was made. Each dot is a dated recording event; one album may appear more than once, or in more than one place.
    </p>
    <p class="intro">
      Places are ordered by their first represented recording. Scroll the field sideways to move through time, or choose a place to see its full record.
    </p>
  </article>

  {#if loadError}
    <p class="fatal">Couldn’t load the recording-place data ({loadError}).</p>
  {:else if data}
    <section
      class="field-wrap"
      style:--field-w="{fieldW}px"
      style:--year-w="{PX_PER_YEAR}px"
      style:--gutter="{GUTTER}px"
    >
      <div class="summary">
        <span>{data.eventCount} dated recording events</span>
        <span aria-hidden="true">·</span>
        <span>{data.rows.length} places</span>
        <span aria-hidden="true">·</span>
        <span>{data.representedAlbumCount} of {albumCount} albums located</span>
        <FollowDates scrollElement={lanesScroll} revision={data.eventCount} inspectionActive={inspectingMark} />
      </div>

      <div
        class="lanes-scroll"
        bind:this={lanesScroll}
      >
        <div class="field">
          <div class="axis">
            <div class="axis-name display">Recording place</div>
            <div class="axis-track">
              {#each years as year}
                {@const yearX = xm((year - data.yearStart) * 12)}
                <span class="tick" style:left="{yearX}px"></span>
                <span
                  class="tick-label display"
                  class:minor={year % 5 !== 0}
                  style:left="{yearX + 4}px"
                >{year % 5 === 0 ? year : `’${String(year).slice(2)}`}</span>
              {/each}
            </div>
          </div>

          {#each data.rows as row (row.place.id)}
            <div
              class="place-row"
              class:approximate={row.place.precision === 'city'}
              style:--row-h="{rowHeight(row)}px"
              data-follow-row={row.place.id}
            >
              <button
                class="place-name"
                onclick={() => onOpenPlace(row.place.id)}
                aria-label={`${row.place.name}, ${row.place.city} — open place`}
              >
                <span class="venue">{row.place.name}</span>
                <span class="place-meta">
                  {row.place.city} · {kindLabel[row.place.kind]}
                  {#if row.place.precision === 'city'} · city-level{/if}
                </span>
              </button>
              <div class="lane-cell" style:width="{svgW}px">
                {#if row.groups.length === 0 && row.unsupportedDates.length}
                  <span class="unplotted">{row.unsupportedDates.join(', ')} — date span not plotted</span>
                {/if}
                {#each row.groups as group (`${row.place.id}|${group.date}|${group.events[0].albumId}`)}
                  {@const groupX = xm(recordingMonthOffset(group.date, data.yearStart))}
                  {@const groupYPos = groupY(group, row)}
                  <button
                    class="event-dot"
                    class:soft={row.place.precision === 'city'}
                    style:left="{groupX}px"
                    style:top="{groupYPos}px"
                    data-follow-mark
                    data-follow-control
                    onpointerenter={() => (inspectingMark = true)}
                    onpointerleave={() => (inspectingMark = false)}
                    aria-label={eventLabel(row, group)}
                    title={`${albumName(group.events[0].albumId)} — ${formatDate(group.date)}`}
                    onclick={() => onOpenAlbum(group.events[0].albumId)}
                  ></button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <p class="footnote">
      The field shows known recording locations in the current canon, not a complete history of every session. Hollow marks indicate a location known only to city level. Month-only dates remain month-precise. {data.unsupportedDateCount === 1 ? 'One spanning date is' : `${data.unsupportedDateCount} spanning dates are`} not plotted rather than assigned invented precision.
    </p>
  {:else}
    <p class="fatal">Loading…</p>
  {/if}

</div>

<style>
  .where { height: 100%; overflow-y: auto; background: var(--bg); }
  article { max-width: 720px; margin: 0 auto; padding: 40px 28px 8px; }
  h1 { font-size: 40px; color: var(--bn-blue); letter-spacing: 0.02em; margin-bottom: 10px; }
  .intro { font-family: var(--font-serif); font-size: 16px; line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  .fatal { padding: 30px; color: var(--muted); }

  .field-wrap {
    --name-w: 250px;
    max-width: calc(var(--name-w) + var(--field-w) + 2 * var(--gutter) + 56px);
    margin: 26px auto 0;
    padding: 0 28px;
  }
  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin: 0 0 9px;
    font-size: 13px;
    color: var(--muted);
  }
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
    z-index: 5;
    display: grid;
    grid-template-columns: var(--name-w) 1fr;
    height: 32px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .axis-name {
    position: sticky;
    left: 0;
    z-index: 6;
    display: flex;
    align-items: center;
    padding-left: 12px;
    background: var(--bg);
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.07em;
  }
  .axis-track { position: relative; }
  .tick {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 7px;
    background: var(--muted);
    opacity: 0.45;
  }
  .tick-label {
    position: absolute;
    bottom: 8px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .tick-label.minor { font-size: 10.5px; opacity: 0.65; }

  .place-row {
    display: grid;
    grid-template-columns: var(--name-w) 1fr;
    min-height: var(--row-h);
    border-bottom: 1px solid rgba(230, 224, 214, 0.68);
  }
  .place-row:last-child { border-bottom: 0; }
  .place-row:hover { --row-bg: var(--surface); }
  .place-name {
    --row-bg: var(--bg);
    position: sticky;
    left: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    min-width: 0;
    height: var(--row-h);
    padding: 3px 10px 3px 12px;
    border: 0;
    border-right: 1px solid var(--line);
    background: var(--row-bg);
    text-align: left;
  }
  .place-name:hover { color: var(--bn-blue); }
  .place-name:focus-visible { outline: 2px solid var(--bn-blue-light); outline-offset: -2px; }
  .venue {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .place-meta {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10.5px;
    color: var(--muted);
  }
  .approximate .place-meta { font-style: italic; }

  .lane-cell {
    position: relative;
    height: var(--row-h);
    background-color: var(--row-bg, var(--bg));
    background-image: repeating-linear-gradient(
      to right,
      var(--line) 0 1px,
      transparent 1px var(--year-w)
    );
    background-position-x: var(--gutter);
  }
  .event-dot {
    position: absolute;
    z-index: 1;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    /* Keyboard focus and automated scrollIntoView must leave the target clear
       of the sticky place-name column rather than parking it underneath. */
    scroll-margin-left: calc(var(--name-w) + 24px);
    scroll-margin-right: 24px;
  }
  .event-dot::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%);
    border: 1px solid var(--bg);
    border-radius: 50%;
    background: var(--bn-blue);
    box-shadow: 0 0 0 1px rgba(43, 95, 122, 0.28);
  }
  .event-dot:hover,
  .event-dot:focus-visible {
    z-index: 2;
    outline: 2px solid var(--impulse-amber);
    outline-offset: -2px;
  }
  .event-dot:hover::before,
  .event-dot:focus-visible::before {
    transform: translate(-50%, -50%) scale(1.4);
  }
  .event-dot.soft::before {
    background: var(--bg);
    border-color: var(--bn-blue-light);
    box-shadow: 0 0 0 2px rgba(74, 124, 149, 0.16);
  }

  .unplotted {
    position: absolute;
    left: var(--gutter);
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    font-style: italic;
    color: var(--muted);
  }

  .footnote {
    max-width: 980px;
    margin: 18px auto 48px;
    padding: 0 28px;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.55;
  }


  @media (max-width: 620px) {
    article { padding: 26px 18px 6px; }
    h1 { font-size: 30px; }
    .field-wrap {
      --name-w: 148px;
      padding: 0 14px;
      max-width: calc(var(--name-w) + var(--field-w) + 2 * var(--gutter) + 28px);
    }
    .venue { font-size: 11.5px; }
    .place-meta { font-size: 9.5px; }
    .axis-name { font-size: 9.5px; padding-left: 8px; }
    .footnote { padding: 0 18px; }
  }
</style>

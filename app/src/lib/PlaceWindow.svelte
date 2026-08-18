<script lang="ts">
  import { loadAlbums, loadPlaces } from './data';
  import { sessionSortKey, DEV } from './places-data';
  import type { AlbumCard, Place, PlaceAlbumRef, PlaceKind } from './types';

  let {
    placeId,
    onOpenAlbum,
    onmeta,
  }: {
    placeId: string;
    onOpenAlbum: (albumId: string) => void;
    onmeta?: (m: { name: string }) => void;
  } = $props();

  interface Row {
    album: AlbumCard;
    ref: PlaceAlbumRef;
    key: string;
  }

  let place = $state<Place | null>(null);
  let rows = $state<Row[] | null>(null);
  let error = $state<string | null>(null);

  const kindLabel: Record<PlaceKind, string> = {
    studio: 'Studio',
    club: 'Club',
    home: 'Home studio',
    hall: 'Concert hall',
    festival: 'Festival',
    other: 'Venue',
  };

  $effect(() => {
    const id = placeId;
    place = null;
    rows = null;
    error = null;
    Promise.all([loadPlaces(), loadAlbums()])
      .then(([pd, albums]) => {
        if (id !== placeId) return;
        const p = pd.byId.get(id);
        if (!p) {
          error = `Unknown place “${id}”.`;
          return;
        }
        place = p;
        onmeta?.({ name: p.name });
        const byId = new Map(albums.map((a) => [a.id, a]));
        const out: Row[] = [];
        for (const ref of p.albums) {
          const album = byId.get(ref.albumId);
          if (!album) {
            /* contract says impossible; never crash the window */
            if (DEV)
              console.warn(
                `places.json: album "${ref.albumId}" at place "${id}" missing from albums.json — skipped`,
              );
            continue;
          }
          out.push({ album, ref, key: sessionSortKey(ref) });
        }
        /* the temporal story of the room: earliest session here first */
        out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        rows = out;
      })
      .catch((e) => (error = String(e)));
  });
</script>

<div class="pw">
  {#if error}
    <p class="error">Couldn’t load this place ({error}).</p>
  {:else if !place || !rows}
    <p class="loading">Loading…</p>
  {:else}
    <div class="meta">
      <span class="city">{place.city}</span>
      <span class="chip display">{kindLabel[place.kind]}</span>
      {#if place.precision === 'city'}
        <span class="precision">located to city level</span>
      {/if}
      <a
        class="gmaps"
        href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`}
        target="_blank"
        rel="noopener noreferrer"
      >Open in Google Maps&thinsp;↗</a>
    </div>
    <ol class="rows">
      {#each rows as row (row.album.id)}
        <li>
          <button class="row" onclick={() => onOpenAlbum(row.album.id)}>
            <img class="thumb" src={row.album.artUrl} alt="" loading="lazy" />
            <span class="row-meta">
              <span class="row-title">{row.album.title}</span>
              <span class="row-artist">{row.album.artist} · {row.ref.year}</span>
            </span>
            <span class="row-dates">
              {row.ref.dates.length ? row.ref.dates.join(', ') : row.ref.year}
            </span>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .pw { padding: 10px 22px 30px; }

  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 8px 0 12px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .city { color: var(--muted); }
  .chip {
    font-variant: small-caps;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: var(--bn-blue);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 1px 10px;
    background: var(--bg);
  }
  .precision { font-size: 12.5px; color: var(--muted); font-style: italic; }
  .gmaps {
    margin-left: auto;
    font-size: 12.5px;
    color: var(--bn-blue);
    text-decoration: none;
  }
  .gmaps:hover { text-decoration: underline; }

  /* One long, scrollable list — Van Gelder Englewood Cliffs is 59 albums;
     the story reads top to bottom, no pagination. Scrolling comes from
     FloatingWindow's .panel-body. */
  .rows { list-style: none; margin: 0; padding: 0; }
  .rows li { border-bottom: 1px solid var(--line); }
  .rows li:last-child { border-bottom: none; }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 2px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
  }
  .row:hover { background: var(--bg); }
  .thumb {
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 3px;
    background: var(--line);
  }
  .row-meta { min-width: 0; display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .row-title { font-weight: 600; font-size: 14px; color: var(--ink); }
  .row-artist { font-size: 12.5px; color: var(--muted); }
  .row-dates { flex: 0 0 auto; font-size: 12.5px; color: var(--muted); text-align: right; }

  .loading, .error { color: var(--muted); padding: 12px 0; }

  @media (max-width: 620px) {
    .pw { padding: 8px 14px 30px; }
    .row-dates { display: none; }
  }
</style>

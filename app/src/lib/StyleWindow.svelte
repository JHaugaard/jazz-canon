<script lang="ts">
  import { loadAlbums } from './data';
  import { buildStyleIndex, type StyleEntry } from './styles';
  import { ERA_BANDS, STYLE_INK } from './timeline-layout';

  /* Every canon album in one style (or the ECM label tag), oldest first —
     the style counterpart of PlaceWindow, opened from search (D27). Albums
     whose primary style this is come first; albums that only carry it as a
     secondary tag follow in their own list, so the two are never confused. */

  let {
    code,
    onOpenAlbum,
    onmeta,
  }: {
    code: string;
    onOpenAlbum: (albumId: string) => void;
    onmeta?: (m: { name: string }) => void;
  } = $props();

  let entry = $state<StyleEntry | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    const c = code;
    entry = null;
    error = null;
    loadAlbums()
      .then((albums) => {
        if (c !== code) return;
        const found = buildStyleIndex(albums).find((s) => s.code === c);
        if (!found) {
          error = `Unknown style “${c}”.`;
          return;
        }
        entry = found;
        onmeta?.({ name: found.name });
      })
      .catch((e) => (error = String(e)));
  });

  let era = $derived(entry ? ERA_BANDS.find((b) => b.name === entry!.name) ?? null : null);
  let ink = $derived(STYLE_INK[code] ?? 'var(--muted)');
</script>

<div class="sw">
  {#if error}
    <p class="error">Couldn’t load this style ({error}).</p>
  {:else if !entry}
    <p class="loading">Loading…</p>
  {:else}
    <div class="meta">
      <span class="kind" style:color={ink}>{entry.kind === 'label' ? 'Record label' : 'Style'}</span>
      <span>{entry.primary.length + entry.tagged.length} album{entry.primary.length + entry.tagged.length === 1 ? '' : 's'}</span>
      {#if era}<span class="era">Era on the timeline: {era.from}–{era.to}</span>{/if}
    </div>

    {#each [{ label: entry.kind === 'label' ? null : 'Primary style', list: entry.primary }, { label: entry.kind === 'label' ? null : 'Also tagged', list: entry.tagged }] as part}
      {#if part.list.length}
        {#if part.label && entry.primary.length && entry.tagged.length}
          <h3 class="part">{part.label}</h3>
        {/if}
        <ol class="rows">
          {#each part.list as album (album.id)}
            <li>
              <button class="row" onclick={() => onOpenAlbum(album.id)}>
                <img class="thumb" src={album.artUrl} alt="" loading="lazy" />
                <span class="row-meta">
                  <span class="row-title">{album.title}</span>
                  <span class="row-artist">{album.artist}</span>
                </span>
                <span class="row-year">{album.year}</span>
              </button>
            </li>
          {/each}
        </ol>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .sw { padding: 10px 22px 30px; }

  .meta {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px 16px;
    padding: 8px 0 12px;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-md);
    color: var(--muted);
  }
  .kind { font-weight: 600; }

  .part {
    font-size: var(--fs-base);
    color: var(--bn-blue);
    margin: 16px 0 2px;
  }

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
    background: var(--line);
  }
  .row-meta { min-width: 0; display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .row-title { font-weight: 600; font-size: var(--fs-md); color: var(--ink); }
  .row-artist { font-size: var(--fs-sm); color: var(--muted); }
  .row-year { flex: 0 0 auto; font-size: var(--fs-sm); color: var(--muted); font-variant-numeric: tabular-nums; }

  .loading, .error { color: var(--muted); padding: 12px 0; }

  @media (max-width: 620px) {
    .sw { padding: 8px 14px 30px; }
  }
</style>

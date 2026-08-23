<script lang="ts">
  import type { AlbumCard } from './types';
  import { GATES, gatesOf, primaryGate } from './gates';

  let { album, onopen }: { album: AlbumCard; onopen: (id: string) => void } = $props();

  let artFailed = $state(false);

  // Cover-art URLs arrive from mccoy's export; a minority are plain http and
  // pay a 307 redirect to https on every load. Upgrade at render time — the
  // export is never edited, only the URL the browser is handed.
  let artSrc = $derived(album.artUrl.replace(/^http:\/\//, 'https://'));

  // Records that arrived through an opened genre gate are marked on the card
  // rather than on the canvas: a top-edge accent for the genre gate, and a
  // separate, quieter pip for the ECM label tag (a label should never read
  // with a genre's weight).
  let gates = $derived(gatesOf(album));
  let accent = $derived(primaryGate(album));
  let accentVar = $derived(GATES.find((g) => g.key === accent)?.cssVar ?? null);
  let isEcm = $derived(gates.includes('ecm'));
  let gateTitle = $derived(
    gates.length
      ? ` · via ${gates.map((k) => GATES.find((g) => g.key === k)!.label).join(' + ')}`
      : ''
  );
</script>

<button
  class="card"
  onclick={() => onopen(album.id)}
  title={`${album.title} — ${album.artist} (${album.year})${gateTitle}`}
>
  {#if accentVar}
    <span class="gate-edge" style:background={accentVar}></span>
  {/if}
  <div class="art">
    {#if !artFailed}
      <img
        src={artSrc}
        alt={`${album.title} cover`}
        loading="lazy"
        decoding="async"
        onerror={() => (artFailed = true)}
      />
    {:else}
      <div class="art-fallback">
        <span class="display fallback-title">{album.title}</span>
      </div>
    {/if}
    <span class="year-badge">{album.year}</span>
  </div>
  <div class="meta">
    <span class="title">{album.title}</span>
    <span class="artist">{album.artist}</span>
    <span class="style-line">
      <span class="style display">{album.style}</span>
      {#if isEcm}<span class="ecm-tag" title="ECM — a label tag, not a genre">ECM</span>{/if}
    </span>
  </div>
</button>

<style>
  .card {
    position: absolute;
    width: 148px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    text-align: left;
    overflow: hidden;
    transition: box-shadow 120ms ease, transform 120ms ease, border-color 120ms ease;
  }

  /* genre-gate accent: a top edge, the card's own frame speaking */
  .gate-edge {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 2;
  }
  .card:hover, .card:focus-visible {
    border-color: var(--bn-blue-light);
    box-shadow: 0 4px 14px rgba(28, 26, 23, 0.14);
    transform: translateY(-2px);
    outline: none;
  }
  .art {
    position: relative;
    width: 146px;
    height: 146px;
    background: var(--line);
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .art-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: linear-gradient(160deg, rgba(43, 95, 122, 0.16), rgba(43, 95, 122, 0.05));
    border-bottom: 1px solid var(--line);
  }
  .fallback-title {
    font-size: 15px;
    color: var(--bn-blue);
    text-align: center;
    line-height: 1.2;
  }
  .year-badge {
    position: absolute;
    left: 6px;
    bottom: 6px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 12.5px;
    letter-spacing: 0.04em;
    color: var(--bg);
    background: rgba(28, 26, 23, 0.82);
    padding: 2px 7px;
    border-radius: 4px;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 7px 9px 8px;
  }
  .title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist {
    font-size: 11.5px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .style-line {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
  }
  .style {
    font-size: 11px;
    color: var(--bn-blue);
    font-variant: small-caps;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* the label tag, deliberately smaller and quieter than the style it sits
     beside — ECM is an imprint, not a genre */
  .ecm-tag {
    flex: 0 0 auto;
    font-family: var(--font-body);
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--muted);
    border: 1px solid var(--gate-ecm);
    border-radius: 3px;
    padding: 0 3px;
    line-height: 1.45;
  }
</style>

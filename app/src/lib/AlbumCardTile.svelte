<script lang="ts">
  import type { AlbumCard } from './types';
  import { GATES, gatesOf } from './gates';
  import { STYLE_INK } from './timeline-layout';

  let { album, onopen }: { album: AlbumCard; onopen: (id: string) => void } = $props();

  let artFailed = $state(false);

  // Cover-art URLs arrive from mccoy's export; a minority are plain http and
  // pay a 307 redirect to https on every load. Upgrade at render time — the
  // export is never edited, only the URL the browser is handed.
  let artSrc = $derived(album.artUrl.replace(/^http:\/\//, 'https://'));

  // Covers stay clean (D27, 2026-09-26): no year label, no genre badge, no
  // gate accent on the art. The era hue moves to the style line instead,
  // and the ECM label tag stays beside it. Gates still name themselves in
  // the tooltip.
  let gates = $derived(gatesOf(album));
  let isEcm = $derived(gates.includes('ecm'));
  let styleInk = $derived(STYLE_INK[album.styleCode] ?? 'var(--muted)');
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
  </div>
  <div class="meta">
    <span class="title">{album.title}</span>
    <span class="artist">{album.artist}</span>
    <span class="style-line">
      <span class="style" style:color={styleInk}>{album.style}</span>
      {#if isEcm}<span class="ecm-tag" title="ECM — a label tag, not a genre">ECM</span>{/if}
    </span>
  </div>
</button>

<style>
  /* A record in a rack: square cover with a hairline edge, text on the paper
     below. No card box, no rounded corners, no drop shadow (D27). */
  .card {
    position: absolute;
    width: 148px;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
  }
  .art {
    position: relative;
    width: 148px;
    height: 148px;
    background: var(--line);
  }
  /* hairline drawn over the image so light covers keep an edge */
  .art::after {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 1px rgba(28, 26, 23, 0.12);
    pointer-events: none;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .card:hover .art::after, .card:focus-visible .art::after {
    box-shadow: inset 0 0 0 2px var(--bn-blue);
  }
  .card:focus-visible { outline: none; }
  .card:hover .title, .card:focus-visible .title { color: var(--bn-blue); }
  .art-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: rgba(43, 95, 122, 0.1);
  }
  .fallback-title {
    font-size: var(--fs-base);
    color: var(--bn-blue);
    text-align: center;
    line-height: 1.2;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 7px 1px 0;
  }
  .title {
    font-size: var(--fs-md);
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist, .style {
    font-size: var(--fs-sm);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .artist { color: var(--muted); }
  .style-line {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }
  .style { font-weight: 600; }
  /* the label tag, deliberately quieter than the style it sits beside —
     ECM is an imprint, not a genre */
  .ecm-tag {
    flex: 0 0 auto;
    font-size: var(--fs-2xs);
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--muted);
    border: 1px solid var(--gate-ecm);
    padding: 0 3px;
    line-height: 1.45;
  }
</style>

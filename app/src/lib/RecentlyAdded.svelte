<script lang="ts">
  import type { AlbumCard } from './types';
  import { loadAlbums, loadRecentlyAdded } from './data';

  let { onopen }: { onopen: (id: string) => void } = $props();

  type Row = { album: AlbumCard };
  type Group = { label: string; items: Row[] };
  let groups = $state<Group[] | null>(null);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  // "YYYY-MM-DD" → "July 2026", parsed by hand to avoid timezone drift.
  function monthLabel(iso: string): string {
    const [y, m] = iso.split('-');
    return `${MONTHS[Number(m) - 1]} ${y}`;
  }

  Promise.all([loadAlbums(), loadRecentlyAdded()]).then(([albums, recent]) => {
    const byId = new Map(albums.map((a) => [a.id, a]));
    const rows = recent
      .filter((r) => byId.has(r.id))
      .sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0)); // reverse chron

    const out: Group[] = [];
    for (const r of rows) {
      const label = monthLabel(r.added);
      const last = out[out.length - 1];
      const row = { album: byId.get(r.id)! };
      if (last && last.label === label) last.items.push(row);
      else out.push({ label, items: [row] });
    }
    groups = out;
  });
</script>

{#if groups && groups.length}
  <section class="recent" aria-label="Recently added to the canon">
    <h2 class="display">Recently added</h2>
    <p class="hint">New to the site — the date is when it first appeared here, not when the record was made.</p>
    <div class="scroll">
      {#each groups as g}
        <p class="date display">{g.label}</p>
        <ul>
          {#each g.items as { album }}
            <li>
              <button class="row" onclick={() => onopen(album.id)} title="Open {album.title}">
                <span class="who">{album.artist}</span>
                <span class="what">{album.title}</span>
                <span class="year">{album.year}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </div>
  </section>
{/if}

<style>
  .recent {
    margin: 32px 0 8px;
    padding: 14px 16px 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
  }
  h2 { font-size: 17px; color: var(--ink); letter-spacing: 0.02em; margin: 0 0 3px; }
  .hint { font-family: var(--font-serif); font-size: 12px; color: var(--muted); margin: 0 0 8px; }

  /* fixed window: shows ~6 additions, then scrolls */
  .scroll {
    max-height: 264px;
    overflow-y: auto;
    /* room so the scrollbar doesn't crowd the year column */
    padding-right: 4px;
  }
  .date {
    font-variant: small-caps;
    font-size: 11.5px;
    letter-spacing: 0.08em;
    color: var(--impulse-amber);
    margin: 11px 0 4px;
  }
  .date:first-of-type { margin-top: 0; }
  ul { list-style: none; margin: 0; padding: 0; }
  li + li { border-top: 1px solid var(--line); }

  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 1px 12px;
    background: none;
    border: none;
    text-align: left;
    padding: 5px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  .row:hover { background: var(--bg); }
  .row:hover .what { color: var(--bn-blue); }

  .who {
    grid-column: 1;
    font-family: var(--font-display);
    font-variant: small-caps;
    letter-spacing: 0.03em;
    font-size: 12px;
    color: var(--muted);
  }
  .what {
    grid-column: 1;
    font-size: 13.5px;
    color: var(--ink);
    line-height: 1.2;
  }
  .year {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-family: var(--font-display);
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 620px) {
    .recent { padding: 12px 12px 12px; }
  }
</style>

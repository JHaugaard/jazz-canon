<script lang="ts">
  import { loadPeopleActivity } from './data';
  import type { PeopleData } from './people-data';
  import introRaw from './content/working-intro.txt?raw';

  let { onOpenPerson }: { onOpenPerson: (pid: string) => void } = $props();

  const paragraphs = introRaw.trim().split(/\n\s*\n/);

  let data = $state<PeopleData | null>(null);
  let loadError = $state<string | null>(null);

  loadPeopleActivity()
    .then((d) => (data = d))
    .catch((e) => (loadError = String(e)));
</script>

<div class="working">
  <article>
    <h1 class="display">Working</h1>
    {#each paragraphs as p}
      <p class="intro">{p}</p>
    {/each}
  </article>

  {#if loadError}
    <p class="fatal">Couldn't load the activity data ({loadError}).</p>
  {:else if !data}
    <p class="fatal">Loading…</p>
  {:else}
    <!-- lane field lands here in Task 4 -->
    <p class="footnote">
      {data.meta.undatedSessions} sessions across {data.meta.undatedAlbums.length}
      albums carry no usable date and are not drawn; {data.meta.undatedOnlyPeople}
      musicians appear only on those sessions. “Final exit” marks a musician's
      last appearance in this canon — not death or retirement.
    </p>
  {/if}
</div>

<style>
  .working { height: 100%; overflow-y: auto; background: var(--bg); }
  article { max-width: 720px; margin: 0 auto; padding: 40px 28px 8px; }
  h1 { font-size: 40px; color: var(--bn-blue); letter-spacing: 0.02em; margin-bottom: 10px; }
  .intro { font-family: var(--font-serif); font-size: 16px; line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  .fatal { padding: 30px; color: var(--muted); }
  .footnote { max-width: 940px; margin: 18px auto 48px; padding: 0 28px; font-size: 13px; color: var(--muted); line-height: 1.55; }
  @media (max-width: 620px) {
    article { padding: 26px 18px 6px; }
    h1 { font-size: 30px; }
  }
</style>

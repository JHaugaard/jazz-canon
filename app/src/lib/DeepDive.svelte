<script lang="ts">
  import type { AlbumCard, AlbumDetail } from './types';
  import { loadDetails, loadPlaces, loadBasemap } from './data';
  import EpistemicBadge from './EpistemicBadge.svelte';
  import MiniMap from './MiniMap.svelte';
  import type { AlbumPlace } from './places-data';
  import type { Basemap } from './places-geo';

  let {
    album,
    onOpenPerson,
    onOpenPlace,
  }: {
    album: AlbumCard;
    onOpenPerson: (personId: string) => void;
    onOpenPlace: (placeId: string) => void;
  } = $props();

  let detail = $state<AlbumDetail | null>(null);
  let error = $state<string | null>(null);
  let personnelOpen = $state(false);
  let artFailed = $state(false);
  let placeEntries = $state<AlbumPlace[] | null>(null);
  let basemap = $state<Basemap | null>(null);
  let placesError = $state<string | null>(null); // holds the FAILED FILE's name

  // --- 30-second Apple preview playback ---
  // one shared audio element; `playing` is the previewUrl currently sounding.
  let audio: HTMLAudioElement | null = null;
  let playing = $state<string | null>(null);
  let albumMode = $state(false); // playing straight through the album's previews

  function ensureAudio(): HTMLAudioElement {
    if (!audio) {
      audio = new Audio();
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('pause', () => {
        if (audio && audio.paused) { /* keep state; explicit stops clear it */ }
      });
    }
    return audio;
  }

  function stop() {
    audio?.pause();
    playing = null;
    albumMode = false;
  }

  function playUrl(url: string) {
    const a = ensureAudio();
    a.src = url;
    a.currentTime = 0;
    a.play().then(() => (playing = url)).catch(() => (playing = null));
  }

  function toggleTrack(url: string) {
    if (playing === url) { stop(); return; }
    albumMode = false;
    playUrl(url);
  }

  function playAlbum() {
    if (!detail) return;
    const first = detail.tracks.find((t) => t.previewUrl);
    if (!first?.previewUrl) return;
    if (albumMode) { stop(); return; }
    albumMode = true;
    playUrl(first.previewUrl);
  }

  function onEnded() {
    if (!albumMode || !detail) { playing = null; return; }
    const urls = detail.tracks.map((t) => t.previewUrl).filter(Boolean) as string[];
    const i = urls.indexOf(playing ?? '');
    const next = i >= 0 ? urls[i + 1] : undefined;
    if (next) playUrl(next);
    else stop();
  }

  const hasPreviews = $derived(!!detail?.tracks.some((t) => t.previewUrl));

  $effect(() => {
    const id = album.id;
    detail = null;
    error = null;
    personnelOpen = false;
    artFailed = false;
    stop();
    loadDetails()
      .then((all) => {
        if (album.id === id) detail = all[id] ?? null;
      })
      .catch((err) => (error = String(err)));
    placeEntries = null;
    placesError = null;
    loadPlaces()
      .then((pd) => {
        if (album.id === id) placeEntries = pd.byAlbum.get(id) ?? [];
      })
      .catch(() => (placesError = 'places.json'));
    loadBasemap()
      .then((bm) => (basemap = bm))
      .catch(() => (placesError = 'basemap.json'));
  });

  // stop audio when the panel is torn down or the album changes
  $effect(() => {
    void album.id;
    return () => stop();
  });

  const scopeNote: Record<string, string | null> = {
    'all-tracks': null,
    'selected-tracks': 'selected tracks',
    unknown: 'track assignment unknown',
  };
</script>

<div class="dd">
  <header>
    <div class="art">
      {#if !artFailed}
        <img src={album.artUrl} alt={`${album.title} cover`} onerror={() => (artFailed = true)} />
      {:else}
        <div class="art-fallback display">{album.title}</div>
      {/if}
    </div>
    <div class="head-meta">
      <h2 class="title">{album.title}</h2>
      <div class="artist">{album.artist}</div>
      <div class="facts">
        {album.year}{#if album.label}&ensp;·&ensp;{album.label}{/if}{#if album.catalog}&ensp;·&ensp;{album.catalog}{/if}
      </div>
      <div class="style display">{album.style}</div>
      <div class="cta-row">
        {#if album.appleAlbumId}
          <a
            class="apple"
            href={`https://music.apple.com/us/album/${album.appleAlbumId}`}
            target="_blank"
            rel="noopener noreferrer"
          >Listen on Apple Music&thinsp;↗</a>
        {/if}
        {#if hasPreviews}
          <button class="playall" onclick={playAlbum} aria-pressed={albumMode}>
            <span class="pa-icon">{albumMode ? '❚❚' : '▶'}</span>
            {albumMode ? 'Stop previews' : 'Play album previews'}
          </button>
        {/if}
      </div>
    </div>
  </header>

  {#if error}
    <p class="error">Couldn’t load album details ({error}).</p>
  {:else if !detail}
    <p class="loading">Loading…</p>
  {:else}
    {#if detail.description}
      <section class="editorial">
        <span class="editorial-label">Editorial note</span>
        {detail.description}
      </section>
    {/if}

    <section>
      <h3 class="sec">Recording</h3>
      {#if detail.recordingDates}
        <div class="rec-row"><span class="rec-k">Recorded</span>{detail.recordingDates}</div>
      {/if}
      {#if placesError}
        <!-- no silent fallback: keep the legacy text row, name the failed file -->
        {#if detail.studios.length}
          <div class="rec-row"><span class="rec-k">Studio</span>{detail.studios.join(' · ')}</div>
        {/if}
        <p class="map-err">Couldn’t load {placesError} — map unavailable.</p>
      {:else if placeEntries !== null && basemap !== null && placeEntries.length > 0}
        <MiniMap entries={placeEntries} {basemap} {onOpenPlace} />
      {:else if detail.studios.length}
        <!-- placeless album (absence of a pin must never read as "recorded
             nowhere") — or places still loading; either way the text row -->
        <div class="rec-row"><span class="rec-k">Studio</span>{detail.studios.join(' · ')}</div>
      {/if}
      {#if detail.leader}
        <div class="rec-row"><span class="rec-k">Leader</span>{detail.leader}</div>
      {/if}
    </section>

    <section>
      <h3 class="sec">Tracks</h3>
      <ol class="tracks">
        {#each detail.tracks as t}
          <li>
            <div class="trackline">
              {#if t.previewUrl}
                <button
                  class="tplay"
                  class:playing={playing === t.previewUrl}
                  onclick={() => toggleTrack(t.previewUrl!)}
                  aria-label={playing === t.previewUrl ? `Pause preview of ${t.title}` : `Play 30-second preview of ${t.title}`}
                  title="30-second preview"
                >{playing === t.previewUrl ? '❚❚' : '▶'}</button>
              {:else}
                <span class="tplay tplay-empty" aria-hidden="true"></span>
              {/if}
              <span class="tn">{t.n ?? '–'}</span>
              <span class="ttitle" class:ep-inf={t.e === 'inf'}>{t.title}</span>
              <EpistemicBadge e={t.e} />
              {#if t.duration}<span class="tdur">{t.duration}</span>{/if}
            </div>
            {#if t.personnel.length}
              <div class="tpersonnel">
                {#each t.personnel as p, i}
                  {#if i > 0}<span class="sep">·</span>{/if}
                  <button class="person" onclick={() => onOpenPerson(p.personId)}>
                    <span class:ep-inf={p.e === 'inf'}>{p.name}</span></button
                  ><span class="inst">&thinsp;{p.instrument}</span><EpistemicBadge e={p.e} />
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    </section>

    <section>
      <button class="expander" onclick={() => (personnelOpen = !personnelOpen)}>
        <h3 class="sec">Full album personnel</h3>
        <span class="chev">{personnelOpen ? '▾' : '▸'}</span>
      </button>
      {#if personnelOpen}
        <ul class="roster">
          {#each detail.personnel as row}
            <li>
              <button class="person" onclick={() => onOpenPerson(row.personId)}>{row.name}</button>
              <span class="inst">
                {#each row.entries as en, i}{#if i > 0}, {/if}<span class:ep-inf={en.e === 'inf'}>{en.instrument}</span><EpistemicBadge e={en.e} />{/each}
              </span>
              {#if scopeNote[row.scope]}
                <span class="scope">({scopeNote[row.scope]})</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .dd { padding: 18px 22px 40px; }

  header { display: flex; gap: 16px; margin-bottom: 18px; }
  .art {
    flex: 0 0 168px;
    width: 168px;
    height: 168px;
    background: var(--line);
    border-radius: 4px;
    overflow: hidden;
  }
  .art img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .art-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    text-align: center; padding: 12px;
    color: var(--bn-blue); font-size: 16px;
    background: linear-gradient(160deg, rgba(43,95,122,0.16), rgba(43,95,122,0.05));
  }
  .head-meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .title { font-size: 26px; line-height: 1.08; color: var(--ink); }
  .artist { font-size: 15px; font-weight: 600; }
  .facts { font-size: 13px; color: var(--muted); }
  .style { font-size: 13.5px; color: var(--bn-blue); }
  .apple {
    margin-top: 8px;
    align-self: flex-start;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--bn-blue);
    text-decoration: none;
    padding: 7px 12px;
    border-radius: 6px;
  }
  .apple:hover { background: var(--bn-blue-light); }
  .cta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .playall {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--bn-blue);
    background: var(--surface);
    border: 1px solid var(--bn-blue);
    padding: 6px 12px;
    border-radius: 6px;
  }
  .playall:hover { background: var(--bg); }
  .playall[aria-pressed='true'] { background: var(--bn-blue); color: #fff; }
  .pa-icon { font-size: 11px; line-height: 1; }

  section { margin-bottom: 18px; }
  .sec {
    font-size: 15px;
    color: var(--bn-blue);
    border-bottom: 1px solid var(--line);
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .editorial { margin-bottom: 18px; font-size: 14.5px; }

  .rec-row { font-size: 13.5px; margin-bottom: 3px; }
  .rec-k {
    display: inline-block;
    width: 76px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    font-variant: small-caps;
    letter-spacing: 0.05em;
  }

  .tracks { list-style: none; margin: 0; padding: 0; }
  .tracks li { padding: 7px 0; border-bottom: 1px solid var(--line); }
  .tracks li:last-child { border-bottom: none; }
  .trackline { display: flex; align-items: baseline; gap: 7px; }
  .tplay {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    line-height: 1;
    color: var(--bn-blue);
    background: var(--surface);
    border: 1.5px solid var(--bn-blue);
    border-radius: 50%;
    padding: 0;
    padding-left: 1px; /* optically center the ▶ glyph */
  }
  .tplay:hover { background: var(--bn-blue); color: #fff; }
  .tplay.playing { background: var(--bn-blue); color: #fff; padding-left: 0; }
  .tplay-empty { border: none; background: none; }
  .tn {
    flex: 0 0 18px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 12.5px;
    color: var(--muted);
    text-align: right;
  }
  .ttitle { font-weight: 600; font-size: 14px; }
  .tdur { margin-left: auto; font-size: 12.5px; color: var(--muted); }
  .tpersonnel { margin: 3px 0 0 54px; font-size: 12.5px; color: var(--muted); line-height: 1.7; }
  .sep { margin: 0 4px; opacity: 0.6; }

  .person {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
    color: var(--bn-blue);
    text-decoration: none;
  }
  .person:hover { text-decoration: underline; color: var(--bn-blue-light); }
  .inst { color: var(--muted); }

  .expander {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
  }
  .expander .sec { flex: 1; margin-bottom: 0; }
  .chev { color: var(--bn-blue); font-size: 13px; }
  .roster { list-style: none; margin: 10px 0 0; padding: 0; }
  .roster li { padding: 4px 0; font-size: 13.5px; }
  .scope { font-size: 12px; color: var(--muted); font-style: italic; }

  .loading, .error { color: var(--muted); padding: 12px 0; }
  .error { color: var(--impulse-amber); }
  .map-err { font-size: 12.5px; color: var(--impulse-amber); margin: 2px 0 0; }

  @media (max-width: 620px) {
    .dd { padding: 14px 16px 40px; }
    header { gap: 12px; }
    .art { flex: 0 0 116px; width: 116px; height: 116px; }
    .title { font-size: 22px; }
  }
</style>

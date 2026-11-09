<script lang="ts">
  import BallotPanel from './BallotPanel.svelte';
  import { formatShortDate, loadCandidateDossier, readableCode, trackLineup } from './methodology-data';
  import type { CandidateDossier } from './methodology-data';
  import './methodology.css';

  let dossier = $state<CandidateDossier | null>(null);
  let unavailable = $state(false);

  loadCandidateDossier()
    .then((value) => (dossier = value))
    .catch(() => (unavailable = true));
</script>

<div class="method-page">
  <article class="method-article method-article-wide">
    <a class="method-back" href="#/methodology">← Methodology</a>

    {#if dossier}
      <header class="method-example-header">
        <p class="method-kicker">A worked candidate dossier</p>
        <h1 class="display">{dossier.album}</h1>
        <p class="method-lede">{dossier.artist} · {dossier.year} · {dossier.label} · {readableCode(dossier.style_primary)}</p>
        <p>This example shows what the research assistant and AI reviewers place before the curator. The ballot is advice; the curator's listening and decision come afterward.</p>
      </header>

      <BallotPanel {dossier} showCouncil={true} showAlbum={false} />
      <p class="method-note">Source tokens such as S1 and S3 refer to the numbered source list below.</p>

      <section aria-labelledby="method-nomination">
        <h2 id="method-nomination" class="display">The research assistant’s nomination</h2>
        <p>{dossier.rationale}</p>
      </section>

      <section aria-labelledby="method-sessions">
        <h2 id="method-sessions" class="display">Recording sessions</h2>
        <div class="method-table-wrap">
          <table>
            <thead><tr><th scope="col">Date</th><th scope="col">Place</th><th scope="col">Evidence</th><th scope="col">Source</th></tr></thead>
            <tbody>
              {#each dossier.personnel_record.recording_sites as session}
                <tr>
                  <td>{formatShortDate(session.session_date)}</td>
                  <td>{session.site_raw ?? 'Unknown'}</td>
                  <td>{readableCode(session.epistemic)}</td>
                  <td>
                    {#if session.source && dossier.sources[session.source]}
                      <a href="#source-{session.source}">{session.source}</a>
                    {:else}
                      Unknown
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="method-note">Released in {dossier.year}; recorded in 1956. Producer: <strong>{dossier.personnel_record.producer ?? 'Unknown'}</strong>. Engineer: <strong>{dossier.personnel_record.engineer ?? 'Unknown'}</strong>.</p>
      </section>

      <section aria-labelledby="method-personnel">
        <h2 id="method-personnel" class="display">Musicians</h2>
        <div class="method-table-wrap">
          <table>
            <thead><tr><th scope="col">Musician</th><th scope="col">Instrument</th><th scope="col">Coverage</th><th scope="col">Evidence</th></tr></thead>
            <tbody>
              {#each dossier.personnel_record.personnel as person}
                <tr>
                  <td>
                    <strong>{person.name}</strong>
                    {#if person.name_variants.length}<br><span class="method-muted">Also credited as {person.name_variants.join(', ')}</span>{/if}
                    {#if person.notes}<br><span class="method-muted">{person.notes}</span>{/if}
                  </td>
                  <td>{person.instrument}</td>
                  <td>
                    {readableCode(person.scope)}
                    {#if person.tracks}<br><span class="method-muted">{person.tracks.join('; ')}</span>{/if}
                    <br><span class="method-muted">Sources: {#each person.sources as token, i}{#if i > 0}, {/if}<a href="#source-{token}">{token}</a>{/each}</span>
                  </td>
                  <td>{readableCode(person.epistemic)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="method-tracks">
        <h2 id="method-tracks" class="display">Tracks</h2>
        <div class="method-table-wrap">
          <table class="method-tracks-table">
            <thead><tr><th scope="col">Track</th><th scope="col">Title and composer</th><th scope="col">Duration</th><th scope="col">Recorded</th><th scope="col">Personnel</th></tr></thead>
            <tbody>
              {#each dossier.personnel_record.tracks as track}
                <tr>
                  <td>{track.track_number}{track.side ? ` · Side ${track.side}` : ''}</td>
                  <td><strong>{track.title}</strong><br><span class="method-muted">{track.composers.join(', ')}</span></td>
                  <td>{track.duration ?? 'Unknown'}</td>
                  <td>{formatShortDate(track.session_date)}</td>
                  <td>{trackLineup(track, dossier.personnel_record.personnel, 'Full quintet')}<br><span class="method-muted">{readableCode(track.epistemic_track)} · {#each track.sources as token, i}{#if i > 0}, {/if}<a href="#source-{token}">{token}</a>{/each}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <details class="method-disclosure">
          <summary>Show complete personnel for every track</summary>
          <div class="method-full-track-personnel">
            {#each dossier.personnel_record.tracks as track}
              <h3 class="display">{track.track_number}. {track.title}</h3>
              <p>{track.personnel.join(', ')}</p>
            {/each}
          </div>
        </details>
      </section>

      <section aria-labelledby="method-sources">
        <h2 id="method-sources" class="display">Sources</h2>
        <p>The source tokens used throughout this dossier resolve to these seven references.</p>
        <div class="method-source-list">
          {#each Object.entries(dossier.sources) as [token, source]}
            <article id="source-{token}" class="method-source">
              <h3 class="display"><span class="method-source-token">{token}</span> {source.type}</h3>
              <p>{source.title}</p>
              <a href={source.url} target="_blank" rel="noreferrer">Open source ↗</a>
            </article>
          {/each}
        </div>
      </section>

      <section aria-labelledby="method-technical">
        <h2 id="method-technical" class="display">Technical details and research notes</h2>
        <dl class="method-detail-list">
          <div><dt>Dossier ID</dt><dd>{dossier.id}</dd></div>
          <div><dt>Apple album ID</dt><dd>{dossier.apple_album_id ?? 'Not available'}</dd></div>
          <div><dt>MusicBrainz release group</dt><dd>{dossier.musicbrainz_release_group_mbid ?? 'Not available'}</dd></div>
          <div><dt>Track assignments complete</dt><dd>{dossier.personnel_record.track_assignments_complete ? 'Yes' : 'No'}</dd></div>
          <div><dt>Production evidence</dt><dd>{readableCode(dossier.personnel_record.epistemic_production)}</dd></div>
        </dl>
        <p>{dossier.personnel_record.notes}</p>
        {#each dossier.personnel_record.cover_art as art}
          <details class="method-disclosure">
            <summary>Cover-art provenance</summary>
            <p><strong>Source:</strong> {art.source} · <strong>Evidence:</strong> {readableCode(art.epistemic)}</p>
            <p>{art.notes}</p>
            <a href={art.url} target="_blank" rel="noreferrer">Open the referenced image ↗</a>
          </details>
        {/each}
      </section>

      <p class="method-end-link"><a href="/methodology/steamin-candidate-dossier.json" download>Download the complete, unedited JSON dossier</a></p>
    {:else if unavailable}
      <h1 class="display">Candidate dossier unavailable</h1>
      <p>The worked example could not be loaded. Return to the <a href="#/methodology">methodology note</a>.</p>
    {:else}
      <h1 class="display">Loading the candidate dossier…</h1>
    {/if}
  </article>
</div>

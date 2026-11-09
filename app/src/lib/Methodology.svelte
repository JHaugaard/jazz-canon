<script lang="ts">
  import BallotPanel from './BallotPanel.svelte';
  import { formatLongDate, loadCandidateDossier, loadMethodologyStats } from './methodology-data';
  import type { CandidateDossier, MethodologyStats } from './methodology-data';
  import './methodology.css';

  let stats = $state<MethodologyStats | null>(null);
  let statsUnavailable = $state(false);
  let dossier = $state<CandidateDossier | null>(null);
  let dossierUnavailable = $state(false);

  loadMethodologyStats()
    .then((value) => (stats = value))
    .catch(() => (statsUnavailable = true));
  loadCandidateDossier()
    .then((value) => (dossier = value))
    .catch(() => (dossierUnavailable = true));
</script>

<div class="method-page">
  <article class="method-article">
    <a class="method-back" href="#/about">← About</a>
    <h1 class="display">Note on Methodology</h1>

    <section aria-labelledby="method-purpose">
      <h2 id="method-purpose" class="display">Purpose</h2>
      <p>A Jazz Canon is a personal collection of jazz albums, not a comprehensive catalog. The current scope is 1945–1985, based on the year the album was recorded or originally released. The main test is simple: is this an album I would hand a friend to explain what this music is?</p>
      <p class="method-lede">AI helps with research and review. It does not choose the collection. I listen to the candidates and make every final decision.</p>
    </section>

    <section aria-labelledby="method-roles">
      <h2 id="method-roles" class="display">Who does what</h2>
      <ul>
        <li><strong>Research assistant:</strong> one AI research assistant proposes candidates, usually two a day, and prepares a research file for each album.</li>
        <li><strong>Independent reviewers:</strong> two separate AI reviewers assess each research file. A fourth AI model combines their assessments into a ballot, preserving any disagreement.</li>
        <li><strong>Curator:</strong> I read the ballot, listen to the album, and decide whether to include, exclude, or defer it. Mine is the only binding verdict.</li>
        <li><strong>Publishing:</strong> included albums are added to the website in batches. I initiate every website update.</li>
      </ul>
      <p><strong>No AI model can add an album to the collection.</strong></p>
    </section>

    <section aria-labelledby="method-evaluation">
      <h2 id="method-evaluation" class="display">How candidates are evaluated</h2>
      <p>Each candidate is assessed on five factors, in rough order of weight:</p>
      <ul>
        <li><strong>Consensus:</strong> the album appears repeatedly in independent guides, polls, and musician lists.</li>
        <li><strong>Defining statement:</strong> the album establishes an artist's or a scene's sound.</li>
        <li><strong>Lineage:</strong> the album influenced later work or made later developments possible.</li>
        <li><strong>Session gravity:</strong> the recording session brought together musicians who helped define the era or style.</li>
        <li><strong>Lasting value:</strong> the album offers musical pleasure and interest today, not only historical importance.</li>
      </ul>
    </section>

    <section aria-labelledby="method-process">
      <h2 id="method-process" class="display">The candidate process</h2>
      <ol>
        <li><strong>Select and check.</strong> Choose up to two candidates for the daily run. Before research begins, confirm that each album falls within the date range, fits the project's style vocabulary, and is not already in the database. Only then does research begin.</li>
        <li><strong>Gather evidence.</strong> Prepare a research file from published discographies, reference works, album credits, and other cited sources. The target is at least three independent sources per candidate. An AI model's own memory is not accepted as evidence.</li>
        <li><strong>Review independently.</strong> Two AI reviewers assess the research file against the five factors above. Each prepares a case for and against inclusion. Another AI model combines their work into a ballot. If either reviewer does not answer, the process stops and no ballot is produced.</li>
        <li><strong>Stage for review.</strong> The album is marked as a candidate and placed in my review queue with its research file and ballot.</li>
        <li><strong>Report and wait.</strong> I receive the candidate names, ballots, and links to the research files. The automated process then stops until I make a decision.</li>
      </ol>
    </section>

    {#if dossier}
      <BallotPanel {dossier} />
      <p class="method-example-links">
        <a href="#/methodology/example">Read the complete candidate dossier</a>
        <span aria-hidden="true"> · </span>
        <a href="/methodology/steamin-candidate-dossier.json" download>Download the raw JSON</a>
      </p>
    {:else if dossierUnavailable}
      <p class="method-unavailable">The worked ballot is currently unavailable.</p>
    {:else}
      <p class="method-loading">Loading the worked ballot…</p>
    {/if}

    <section aria-labelledby="method-research">
      <h2 id="method-research" class="display">What goes into a research file</h2>
      <p>Each candidate's research file contains:</p>
      <ul>
        <li>basic album details and style classification;</li>
        <li>track-by-track musicians and instruments;</li>
        <li>producer, engineer, and label credits;</li>
        <li>recording dates and locations, with a separate entry for each session date;</li>
        <li>MusicBrainz and Apple reference numbers, when available;</li>
        <li>the source and history of the cover image;</li>
        <li>a list of sources, with evidence labels attached to factual claims;</li>
        <li>a case for inclusion, with a specific source for every rating, award, or guide entry it mentions.</li>
      </ul>
      <p>Every source page is checked to confirm that it concerns the correct artist and album before it can be cited.</p>
    </section>

    <section aria-labelledby="method-evidence">
      <h2 id="method-evidence" class="display">Keeping the evidence straight</h2>
      <p>Every factual claim carries one of three labels:</p>
      <div class="method-table-wrap">
        <table>
          <thead><tr><th scope="col">Label</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><td>Observed (<code>obs</code>)</td><td>Directly stated by a named source</td></tr>
            <tr><td>Inferred (<code>inf</code>)</td><td>Reasoned from documented patterns or neighboring facts</td></tr>
            <tr><td>Uncertain (<code>unk</code>)</td><td>Missing, weakly supported, or disputed evidence</td></tr>
          </tbody>
        </table>
      </div>
      <p>The working rules are straightforward:</p>
      <ul>
        <li>If reliable sources disagree, preserve both claims and explain the disagreement. Do not silently choose a winner.</li>
        <li>Do not guess to fill a gap. If a recording studio is undocumented, it remains unknown rather than being replaced by a plausible one.</li>
        <li>Add a recording location only when its name, city, type, map coordinates, evidence label, and source are complete.</li>
        <li>Never delete an album's database entry. An excluded album remains on file with its research and decision history.</li>
      </ul>
    </section>

    <section aria-labelledby="method-verdicts">
      <h2 id="method-verdicts" class="display">Verdicts and publication</h2>
      <div class="method-table-wrap">
        <table>
          <thead><tr><th scope="col">Verdict</th><th scope="col">What happens</th></tr></thead>
          <tbody>
            <tr><td>Include</td><td>The album waits for the next website update</td></tr>
            <tr><td>Exclude</td><td>The album remains on file with its research and ballot</td></tr>
            <tr><td>Defer</td><td>The album is set aside, and I receive a monthly reminder</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="method-limitations">
      <h2 id="method-limitations" class="display">Known limitations</h2>
      <ul>
        <li>The initial AI search tends to favor well-known albums. I counter that bias with targeted searches of particular artists, labels, styles, and periods.</li>
        <li>Web links, release information, and streaming availability can change. Citations preserve a route back to the evidence for later checking.</li>
        <li>The reviewers' ballot is advice, not a decision. Albums enter the collection only after I listen and choose to include them.</li>
      </ul>
    </section>

    <section aria-labelledby="method-current-state">
      <h2 id="method-current-state" class="display">Current state</h2>
      {#if stats}
        <p class="method-stats">
          Figures from the database at the {formatLongDate(stats.checkedOn)} website update:<br>
          <strong>{stats.publishedAlbums.toLocaleString('en-US')}</strong> published albums,
          <strong>{stats.sources.toLocaleString('en-US')}</strong> sources, and
          <strong>{stats.citations.toLocaleString('en-US')}</strong> individual citations.
        </p>
      {:else if statsUnavailable}
        <p class="method-unavailable">Figures currently unavailable.</p>
      {:else}
        <p class="method-loading">Loading current figures…</p>
      {/if}
    </section>
  </article>
</div>

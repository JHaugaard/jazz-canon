<script lang="ts">
  import type { CandidateReport } from './methodology-data';
  import { readableCode } from './methodology-data';

  let { report, showAlbum = true }: { report: CandidateReport; showAlbum?: boolean } = $props();
  let ballot = $derived(report.ballot);
</script>

<section class="method-ballot" aria-labelledby="method-ballot-heading">
  <h2 id="method-ballot-heading" class="display">AI review ballot</h2>
  {#if showAlbum}<p class="method-ballot-album">{ballot.album}</p>{/if}

  <dl class="method-ballot-meta">
    <div><dt>Assessment</dt><dd>{readableCode(ballot.tier)}<span class="method-meta-note">Strong support in the review</span></dd></div>
    <div><dt>Priority</dt><dd>{readableCode(ballot.priority)}<span class="method-meta-note">Highest priority for this collection</span></dd></div>
    <div><dt>Confidence</dt><dd>{readableCode(ballot.confidence)}<span class="method-meta-note">Confidence in this recommendation</span></dd></div>
    <div><dt>Reviewers answered</dt><dd>{ballot._council.references_answered} of {ballot._council.references.length}<span class="method-meta-note">Independent AI reviews returned</span></dd></div>
  </dl>

  <div class="method-cases">
    <section class="method-case method-case-for" aria-labelledby="method-case-for">
      <h3 id="method-case-for" class="display">Case for inclusion</h3>
      <p>{ballot.case_for}</p>
    </section>
    <section class="method-case method-case-against" aria-labelledby="method-case-against">
      <h3 id="method-case-against" class="display">Case against inclusion</h3>
      <p>{ballot.case_against}</p>
    </section>
  </div>

  <div class="method-recommendation">
    <h3 class="display">AI review recommendation</h3>
    <p>{ballot.recommendation}</p>
    <p><strong>Disagreement:</strong> {ballot.disagreement ?? 'No disagreement recorded.'}</p>
  </div>

  <p class="method-advisory" role="note">
    <strong>This AI review ballot advises the curator; it is not the curator's verdict.</strong>
  </p>
</section>

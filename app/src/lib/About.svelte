<script lang="ts">
  import RecentlyAdded from './RecentlyAdded.svelte';

  let { onopen }: { onopen: (id: string) => void } = $props();

  /* Computed at view time rather than baked in at build, so the notice can't
     go stale in a year the site isn't rebuilt. 2026 is the year of first
     publication and stays fixed. */
  const FIRST_YEAR = 2026;
  const thisYear = new Date().getFullYear();
  const years = thisYear > FIRST_YEAR ? `${FIRST_YEAR}–${thisYear}` : `${FIRST_YEAR}`;
</script>

<div class="about">
  <article>
    <h1 class="display">About A Jazz Canon</h1>
    <p class="lede">
      A personal, opinionated map of records made between 1945 and 1985,
      from bebop through fusion.
      The collection and canon will grow over time.
    </p>

    <h2 class="display">What this is</h2>
    <p>
      This is a discovery tool. It makes one kind of question easy to ask:
      <em>who played on what, with whom, and when.</em>
      Travel the timeline, open a record, and follow a musician into the web of
      sessions around them.
    </p>

    <h2 class="display">Sourced fact vs. editorial voice</h2>
    <p>
      The personnel records, as shown in the Constellations, are the heart of the project, and every one carries
      an honesty label. A credit marked <strong>observed</strong> comes from a
      primary source such as liner notes; <strong>inferred</strong> is drawn
      from session logs and cross-references; <strong>uncertain</strong> marks
      a question the sources leave open.
    </p>
    <aside class="editorial">
      <span class="editorial-label">Editorial note</span>
      Text set in this italic serif is interpretation: a mood, some context,
      or a judgment call about the canon. It is always styled this way so it
      can never be mistaken for a sourced fact.
    </aside>

    <h2 class="display">The eras</h2>
    <p>
      Bebop, Cool Jazz, Hard Bop, Modal Jazz, Post-Bop, Free Jazz, and
      Fusion overlap in time. The colored lines under the timeline's years
      show each era's span, and where eras coexist their lines run side by
      side.
    </p>
    <p>
      Each line marks an era’s center of gravity. A Bebop record made after
      1955 is still Bebop, wherever it falls on the timeline.
    </p>
    <p>
      ECM appears as a record-label tag. Each ECM record here was chosen for
      its music, the same test every other record in the canon passes.
    </p>

    <h2 class="display">Credits</h2>
    <p>
      Cover art and thirty-second previews are provided by Apple Music and the
      Cover Art Archive. The canon, the data, and the opinions are the owner's
      own.
    </p>
    <RecentlyAdded {onopen} />

    <p class="tagline display">Jazz on Record</p>

    <p class="dedication">
      This project and site are dedicated to the memory of Jon Milavec
      (1974–2025). Jon was a musician and artist who loved and was loved by
      his family and friends. Jon is the only person I know who reinforced
      the floor of his music room to handle the weight of his record
      collection. We miss him.
    </p>

    <footer class="contact">
      <span class="by">Gathered by John Haugaard · July 2026</span>
      <a class="email" href="mailto:john@jazzcanon.com">john@jazzcanon.com</a>
    </footer>

    <footer class="legal">
      <p class="copyright">
        Copyright &copy; {years} John Haugaard. All rights reserved.
      </p>
      <p class="rights">
        The canon, the written commentary, and the compiled personnel data are
        the author's own work. Album cover art remains the property of its
        respective copyright holders and is reproduced here, via the Cover Art
        Archive and Apple Music, for identification and commentary. Audio
        previews are served by Apple Music under its terms. Album, track, and
        performer names are the trademarks of their respective owners; their
        use here is descriptive and implies no affiliation or endorsement.
      </p>
    </footer>
  </article>
</div>

<style>
  .about {
    height: 100%;
    overflow-y: auto;
    background: var(--bg);
  }
  article {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 28px 80px;
  }
  h1 {
    font-size: var(--fs-3xl);
    color: var(--bn-blue);
    letter-spacing: 0.02em;
    margin-bottom: 8px;
  }
  h2 {
    font-size: var(--fs-xl);
    color: var(--ink);
    letter-spacing: 0.02em;
    margin: 34px 0 8px;
  }
  .lede {
    font-size: var(--fs-lg);
    line-height: 1.5;
    color: var(--ink);
    margin: 0 0 8px;
  }
  p { font-size: var(--fs-base); line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  em { font-style: italic; color: var(--muted); }
  strong { font-weight: 700; color: var(--ink); }
  .editorial { font-family: var(--font-serif); font-size: var(--fs-base); margin: 8px 0 4px; }
  .tagline {
    margin-top: 40px;
    font-size: var(--fs-xl);
    color: var(--impulse-amber);
    letter-spacing: 0.14em;
  }
  .dedication {
    font-family: var(--font-serif);
    font-size: var(--fs-base);
    line-height: 1.6;
    color: var(--ink);
    margin: 20px 0 0;
  }
  .contact {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    align-items: baseline;
    font-size: var(--fs-md);
    color: var(--muted);
  }
  .contact .by { font-family: var(--font-serif); }
  .contact .email { color: var(--bn-blue); text-decoration: none; }
  .contact .email:hover { text-decoration: underline; }

  /* Legal notice: present and readable, but the quietest thing on the page —
     it should never compete with the writing above it. */
  .legal {
    margin-top: 26px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .legal .copyright {
    font-size: var(--fs-md);
    color: var(--muted);
    margin: 0 0 6px;
  }
  .legal .rights {
    font-size: var(--fs-sm);
    line-height: 1.55;
    color: var(--muted);
    opacity: 0.85;
    margin: 0;
  }

  @media (max-width: 620px) {
    article { padding: 28px 18px 60px; }
    h1 { font-size: var(--fs-2xl); }
    h2 { font-size: var(--fs-xl); }
    .lede { font-size: var(--fs-lg); }
  }
</style>

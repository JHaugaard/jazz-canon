<script lang="ts">
  // Placeholder copy — replace with final editorial text later.
</script>

<div class="about">
  <article>
    <h1 class="display">About A Jazz Canon</h1>
    <p class="lede">
      A personal, opinionated map of records made after
      1949 as jazz moved out of bebop and had not yet crossed
      into fusion. The collection and canon will grow over time.
    </p>

    <h2 class="display">What this is</h2>
    <p>
      This is a discovery tool, not an encyclopedia. It exists to make one kind
      of question easy to ask: <em>who played on what, with whom, and when.</em>
      Travel the timeline, open a record, and follow a musician into the web of
      sessions that surrounds them. Placeholder text follows so the layout can
      be judged before the final writing lands.
    </p>

    <h2 class="display">Sourced fact vs. editorial voice</h2>
    <p>
      The personnel records. as shown in the Constellations, are the heart of the project, and every one carries
      an honesty label. A credit marked <strong>observed</strong> comes from a
      primary source such as liner notes; <strong>inferred</strong> is drawn
      from session logs and cross-references; <strong>uncertain</strong> is
      exactly that — a genuine open question, not a mistake.
    </p>
    <aside class="editorial">
      <span class="editorial-label">Editorial note</span>
      Anything written in this voice — a mood, a bit of context, a judgment
      call about the canon — is interpretation, and it is always styled like
      this so it can never be mistaken for a sourced fact.
    </aside>

    <h2 class="display">The eras</h2>
    <p>
      Cool Jazz, Hard Bop, Soul Jazz, Modal Jazz, and Post-Bop do not sit in
      tidy boxes; they overlap in time, which is why the timeline shows their
      bands blending into one another.
    </p>

    <h2 class="display">Credits</h2>
    <p>
      Cover art and thirty-second previews are provided by Apple Music and the
      Cover Art Archive. The canon, the data, and the opinions are the owner's
      own.
    </p>
    <p class="tagline display">Jazz on Record</p>
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
    font-size: 40px;
    color: var(--bn-blue);
    letter-spacing: 0.02em;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 22px;
    color: var(--ink);
    letter-spacing: 0.02em;
    margin: 34px 0 8px;
  }
  .lede {
    font-family: var(--font-serif);
    font-size: 19px;
    line-height: 1.5;
    color: var(--ink);
    margin: 0 0 8px;
  }
  p { font-size: 15.5px; line-height: 1.65; color: var(--ink); margin: 0 0 12px; }
  em { font-style: italic; color: var(--muted); }
  strong { font-weight: 700; color: var(--ink); }
  .editorial { font-family: var(--font-serif); font-size: 15px; margin: 8px 0 4px; }
  .tagline {
    margin-top: 40px;
    font-size: 20px;
    color: var(--impulse-amber);
    letter-spacing: 0.14em;
  }

  @media (max-width: 620px) {
    article { padding: 28px 18px 60px; }
    h1 { font-size: 30px; }
    h2 { font-size: 20px; }
    .lede { font-size: 17px; }
  }
</style>

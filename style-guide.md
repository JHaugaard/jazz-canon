# A Jazz Canon — Visual Identity (Benchmark Edition)

**Status:** Locked brand constraint — extracted 2026-07-01 from the reference
build's visual design spec. This is the fixed visual identity for the app: logo,
color palette, and typeface choices are not open decisions. Everything about
*layout, component design, and screen composition* is left to you — see
`BRIEF.md`.

**Purpose:** color, typography, and epistemic-treatment language derived from the
visual language of 1950s–1970s jazz album covers.

---

## 1. Design Philosophy

The visual language is drawn from the album cover design of the era the canon
covers — primarily Blue Note Records (Reid Miles / Francis Wolff), Impulse!
Records (Pete Turner), and Columbia Records. Four principles repeat across all
labels and styles in the collection:

1. **Bold condensed sans-serif for titles.** Always heavy, always confident —
   the era's covers favor full uppercase; this identity favors the gentler
   large-cap/small-cap treatment instead (see §3), same confidence without the
   visual weight of an all-caps block.
2. **Limited palettes.** Rarely more than three colors, often just two plus
   black and white.
3. **Single accent against neutral base.** One color carries the emotional
   weight; everything else is structure.
4. **Photography forward, typography respectful.** Text complements the image
   asymmetrically; it does not compete with it.

The site should feel like it belongs to the same world as the covers it
displays — not a museum recreation, but a contemporary tool that carries the
design DNA.

---

## 2. Color Palette

### Base surfaces

```
--bg: #faf8f3            /* warm paper — evokes vinyl sleeve and liner note stock */
--surface: #ffffff        /* cards, panels */
--ink: #1c1a17            /* near-black, warm — primary text */
--muted: #6b6358          /* secondary text */
--line: #e6e0d6           /* borders, dividers */
```

### Accent system

Two accents, each mapped to a specific role in the site's information
architecture:

```
--bn-blue: #2b5f7a        /* Blue Note deep teal-blue — PRIMARY accent */
                         /* links, timeline, UI chrome, era labels, active states */

--bn-blue-light: #4a7c95   /* lighter variant — hover, secondary, focus rings */

--impulse-amber: #c4862a  /* Impulse! warm brass — EDITORIAL accent */
                         /* editorial notes, section headers, inf/unk epistemic states */
```

**Design logic:** Blue Note blue is the brand accent — it carries the site's
identity in the same way the Blue Note label carried theirs. Impulse! amber is
the voice of editorial content — warm, human, distinct from sourced facts — and
it also carries the `inf`/`unk` epistemic states (see below).

**No red.** The palette deliberately contains no red. Reserve it for future
error states only if a genuine need arises.

### Era band colors

Low-saturation tints that harmonize with the cover art palette:

```
--era-cool:    rgba(43, 95, 122, 0.18)    /* Blue Note blue family */
--era-hardbop: rgba(196, 134, 42, 0.18)   /* Impulse! amber family */
--era-modal:   rgba(74, 124, 107, 0.18)   /* muted sage — modal = contemplative */
--era-postbop:  rgba(122, 82, 140, 0.18)   /* deep violet — post-bop = searching */
--era-ink: #5a5249                          /* era label text */
```

### Epistemic color treatment

This is where the visual identity and the app's core requirement (see
`BRIEF.md` §3) meet. The `obs`/`inf`/`unk` labels must be visually distinct
everywhere they appear — but the treatment is deliberately quiet. In the actual
data, the overwhelming majority of performance records are `obs`; `unk` is rare.
A typical visitor should encounter zero or one `unk` badge in a session, so a
single color family (amber) is available to carry both `inf` and `unk` — they
can differ by weight and marker rather than hue, if you choose to reuse this
approach.

**Anti-pattern to avoid:** a traffic-light palette (green/amber/red). Green
implies "verified correct" and red implies "wrong." These are epistemically
distinct states, not quality-ranked assessments. A musician listed as `unk` is
genuinely uncertain — not incorrect.

---

## 3. Typography

Three typefaces, each with a specific role. All available on Google Fonts
(free, no licensing).

```
--font-display: 'Oswald', 'Helvetica Neue Condensed', sans-serif;
--font-body: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
--font-serif: 'Lora', Georgia, 'Times New Roman', serif;
```

**Locked weight:** Oswald at weight **600** (700 is too bulky condensed). Lora
is used for editorial-note body text (a serif, italic register that visually
distinguishes editorial interpretation from sourced fact — see epistemic rules
in `BRIEF.md` §3).

**Case treatment: large-cap/small-cap, not all-caps.** Display text uses
`font-variant: small-caps` rather than `text-transform: uppercase` — source
text stays title-case (e.g. "A Jazz Canon", "Hard Bop") and the browser
synthesizes the small-caps rendering. This reads as confident and condensed
without the visual weight of a full uppercase block.

**Font loading:** via Google Fonts —

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@600&family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;1,400&display=swap" rel="stylesheet" />
```

Three families is the maximum. Oswald is loaded at a single weight (600) — the
locked display weight, no others needed.

How you apply these three typefaces across your own screens/components (sizes,
hierarchy, which elements get which font) is your design decision — the
families, weight, and case treatment above are the fixed constraint.

---

## 4. Logo & Brand Assets

See `brand/`:
- `logo-mark.svg` — the mark alone
- `logo-favicon.svg` — favicon variant
- `logo-lockup-horizontal.svg` / `logo-lockup-stacked.svg` — mark + wordmark +
  tagline, in both orientations

**Tagline:** "Jazz on Record"

**Light-only.** No dark-mode variant exists or is required — the brand and
palette above are designed for a light, warm-paper background.

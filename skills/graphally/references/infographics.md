# Infographics and slides

An infographic makes a few facts land with one reader: a proposal slide, a one-pager, a report
page, a poster. Business readers judge it the way they judge a printed brochure, so it has to look
designed and professional: one strong form, a disciplined grid, few colours, real typography,
and every number drawn to scale. A diagram explains how a system works; an infographic makes
someone remember and act on a point.

This reference holds no finished slide on purpose: a designer shown one example reproduces its
features, even its flaws, when asked for something new (Jansson and Smith, *Design Studies*,
1991). Every figure starts from its own content.

## Contents

- [The method](#the-method): the point, the hero, the numbers, the rest
- [Inventing the hero](#inventing-the-hero): three candidates, then the one only this content has
- [The standard](#the-standard): the rules a professional slide keeps
- [Techniques](#techniques): mechanics the format needs for this kind of page
- [Pitfalls](#pitfalls)
- [Before you hand it over](#before-you-hand-it-over)

## The method

1. **The point.** One sentence the reader should take away, written as the title in the
   reader's terms: what they gain, with the fact or the safeguard that makes it believable. A
   lead line says for whom and how.
2. **The hero.** One form, invented for this content, that shows the point before a label is
   read, and takes the largest area of the page. It is abstract or simplified, never an
   illustrated scene: shapes, lines, areas and type. See [Inventing the hero](#inventing-the-hero).
3. **The numbers.** Each number compared with something (a whole, a before, a target, another
   group) is written large and drawn to scale beside it, in the encoding read most accurately:
   position on a common scale and length before angle, area and colour (Cleveland and McGill,
   *JASA*, 1984). A count or a duration with nothing to compare (3 tiers, 30 days, within 90
   seconds) is written large and not drawn: a chart of it shows no data (Tufte, *The Visual
   Display of Quantitative Information*, 1983).
4. **The rest.** Callouts beside the hero, supporting facts, the source note and the owner at
   the foot, all on one grid.

## Inventing the hero

Sketch three candidates in words before drawing any, each from a different source, then choose.
Designers who weigh several ideas side by side reach better and more varied designs than those
who refine their first (Dow et al., *ACM TOCHI*, 2010).

- **From the content's own structure.** Ask what the facts do: something moves through stages,
  splits, accumulates, shrinks, waits, is contained in something larger, is guarded, branches,
  repeats, or is compared with something else. The verb suggests a form: what moves needs a
  route, what accumulates needs a level, what is contained needs a boundary.
- **From the reader's world.** An object, a place, a tool or a document the reader handles every
  day, reduced to a few shapes: its outline, its sections, its scale. The figure then speaks
  their language before it says anything.
- **From the main number.** A form that makes the number felt: a length against the length it
  replaces, a count of marks against the whole, an area filled to the share, a gap left empty.

Then keep the candidate only this content could have. One that would fit another client or
another subject unchanged is generic; drop it, however polished it would look. Give the chosen
form one idea of its own that a reader remembers: a single element in the accent that breaks
the pattern, a boundary that one item crosses, an empty space where something is missing.

## The standard

These rules hold for every infographic; designers and the research agree on them (one or two
main colours and an accent, two fonts at most, one icon style: Visme's infographic design guide;
pictograms and titles drive recall: Borkin et al., *IEEE TVCG*, 2013 and 2016).

- **One hero**, larger than anything else, carrying the point.
- **Two typefaces at most**: a display face for the title, the big numbers and the labels, and
  a text face for the sentences; the client's own when it has one. The display face need not
  be condensed: a serif, a geometric or a wide grotesque carries big numbers as well. Choosing
  and loading them: [fonts.md](fonts.md).
- **Sizes for where it is read.** A slide on a screen, 1600px wide: title 56 to 72px, big
  numbers 48 to 80px, labels 16 to 20px, sentences 13 to 17px, a letter-spaced eyebrow, tick
  marks and axis labels 12 to 13px, never less. A page that will be printed is sized from the paper: 1600px across A4 or Letter
  landscape, or 1200px across portrait, makes a point about 2px, so sentences at 10 to 12pt are
  20 to 24px and nothing is under 7pt, 14px (Butterick, *Practical Typography*: 10 to 12pt for
  body text in print). A post in a social feed (1200 × 1200, 1200 × 627) is shown at a third to
  half its size, so its smallest text is about 24px, its sentences 28px or more, and its words
  few (Apple's Human Interface Guidelines put the smallest legible text at 11pt).
- **Two or three colours on a neutral ground**: the client's brand colours when it has them.
  Without them, take the palette from the subject or the reader's world (a bank's ink and
  paper, a safety colour for operations, a sector's own convention), with one main colour and
  one accent for what matters most. A colour means one thing throughout: decide what each one
  stands for before using it. Text keeps a contrast of 4.5:1 with its ground, 3:1 when large
  (WCAG 2.2, 1.4.3).
- **One icon style**: the client's own set, or line icons in one weight, or cloud service
  icons where the figure is about those services: [icons.md](icons.md).
- **A grid and air**: equal outer margins (64px on a slide), aligned edges, white space between
  groups; nothing touches, nothing floats.
- **Comparisons drawn, not only written**, each with its numeral beside the drawing. No pies
  of many slices.
- **A guided eye**: one reading path, or steps numbered in reading order; thin leaders from
  callouts to what they name.
- **A finish**: a source note for every figure quoted, the owner or brand in the footer. A
  number worked out from the brief (a payback year, a share of a total) says so in the note,
  and is named to the user to confirm.

What makes a slide look generated rather than designed, to leave out: rows of white cards with
shadows, a tile per number, a gradient hero, emoji, everything centred, more than three colours,
clip-art scenes, text in boxes where a drawn number would do.

## Techniques

**The canvas.** The SVG adds a 24px margin around the page, so a page of W × H pixels is
`<diagram width=W-48>` holding one container `H-48` tall with `position: relative` (and
`box-sizing: border-box` when it has padding); regions inside are placed with grid, flex or
`position: absolute`. A slide's 64px margin is the SVG's 24px and 40px of the container's own
padding. A 16:9 slide of 1600 × 900 is
`width=1552` and a container of 852px; 1920 × 1080 is 1872 and 1032. A one-pager of free length
lets its height follow the content. Set the ground with `background` on `<diagram>`, so the
margin takes it too.

**Shapes the page sits on.** The drawing script paints above the page, so a route, a band or a
field that page elements sit on is drawn in the page instead: an inline `<svg>` placed first in
its region, its shapes made by a before-script (`<script type="graphally" before>`), which fills
it with `innerHTML` or `document.createElementNS`. The same function that makes a shape can place
the elements on it (`left`, `top`), so they follow it. An inline SVG clips to its box; give it
`overflow: visible` for a mark that reaches past its edge.

**For a printer.** Size the page so `--png2x` gives 300 dpi: A4 portrait is 1240 × 1754
(`width=1192`, a container of 1706), landscape 1754 × 1240. A printer that trims the sheet asks
for bleed, usually 3 mm past the cut on every side: the ground runs to the image's edge, the page
grows by 36px each way (1276 × 1790 for A4 portrait), and text stays 6 mm (about 35px) inside
the cut. graphally writes RGB; the printer converts it to CMYK, so give the brand guide's RGB
values and ask for a proof. Hand over the PNG; the printer or a layout tool makes a PDF.

**Marks made from a value.** A before-script makes a count of marks from a number written in the
markup (`data-of=100 data-on=70`), so the drawing and the numeral cannot disagree.

**Lengths to scale.** `width: calc(var(--v) / 144 * 100%)` with `style="--v: 9"` on the mark:
the value is data, the scale is the largest value. In a flex row beside a label, give the mark
`flex: none`, or the row shrinks it off the scale.

**Arcs.** In the drawing script, a track and a share: `draw.arc(c, 46, 0, 360)` and
`draw.arc(c, 46, -90, -90 + 0.68 * 360)`, each `.style({ color, width: 14 })`; the numeral
with `text()`.

**Proportional columns.** `grid-template-columns: minmax(0, 18fr) minmax(0, 140fr)`: a plain
`1fr` grows to fit its content, and a long label would stretch its column off the scale.

**Rounded ends of a row of segments.** Round the container and clip it (`border-radius: 27px;
overflow: hidden`); a box takes one radius for all four corners.

## Pitfalls

- **Class names the building blocks use**: `num`, `card`, `pill`, `tag`, `badge`, `tile`,
  `box`, `banner`, `swatch` (and the others `format.md` lists). A class of yours with one of
  these names keeps the block's look where your rule does not speak: the render warns
  `class-taken` and names what stays. Name yours differently.
- **Names the drawing script defines**: `el`, `all`, `pt`, `mid`, `lerp`, `draw`, `arrow`,
  `curve`, `connect`, `depend`, `text`, `icon`, `shape`, `gate`, `animate`. A `const curve`
  of your own is a script error.
- **`<i>` is italic** in the browser's stylesheet: set `font-style: normal` on an `<i>` that
  holds text.
- **A face the diagram does not load** (in `fonts`, or with `@font-face`) falls back to the
  theme's font, so the text and its measurements change.
- **The drawing script paints over the page**: what must sit on a drawn mark belongs in the
  page (an inline SVG under it), or is drawn by the script after the mark.
- **A plain `1fr` stretches to its content**: proportional grids take `minmax(0, …fr)`.

## Before you hand it over

Render with `--png1x` and look at the image at full size, as the reader will:

- [ ] The point reads from the title and the hero alone, in a few seconds
- [ ] The hero belongs to this content: it would not fit another client unchanged
- [ ] Two typefaces at most, two or three colours on a neutral ground, one icon style
- [ ] Every number that matters is drawn to scale and labelled
- [ ] Margins are equal, edges align, nothing touches or overflows
- [ ] Sources are noted; the owner is in the footer
- [ ] The render prints ok, or only warnings you meant

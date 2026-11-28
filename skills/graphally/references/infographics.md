# Infographics and slides

An infographic makes a few facts land with one reader: a proposal slide, a one-pager, a report
page, a poster, a post. Business readers judge it the way they judge a printed brochure. The
method and the standard are the same as for every figure, in [design.md](design.md): read it
first. This page adds what a page of its own needs: its size, its type sizes, and the
techniques for numbers drawn to scale.

## Contents

- [Formats and sizes](#formats-and-sizes): a slide, a printed page, a post
- [Techniques](#techniques): the canvas, a printer, marks and lengths to scale, arcs
- [Pitfalls](#pitfalls)
- [Before you hand it over](#before-you-hand-it-over)

## Formats and sizes

- **A slide on a screen**, 1600px wide: big numbers 48 to 80px, labels 16 to 20px, sentences
  15 to 17px, tick marks and axis labels 12 to 13px, never less; outer margins of 64px.
- **A page that will be printed** is sized from the paper: 1600px across A4 or Letter landscape,
  or 1200px across portrait, makes a point about 2px, so sentences at 10 to 12pt are 20 to 24px
  and nothing is under 7pt, 14px (Butterick, *Practical Typography*: 10 to 12pt for body text in
  print). The title grows with the paper, as all text does: about 24 to 30px on an A4 page 1240
  wide.
- **A post in a social feed** (1200 × 1200, 1200 × 627) is shown at a third to half its size, so
  its smallest text is about 24px, its sentences 28px or more, and its words few (Apple's Human
  Interface Guidelines put the smallest legible text at 11pt).
- **A one-pager of free length** lets its height follow the content.

With no one to ask, choose the format from where the figure will be used, and say which.

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
its region, its shapes made by a before-script (`<script type="graphally" before>`), which finds
the SVG with `el('#field')` (the page is not the document, so `document.getElementById` finds
nothing) and fills it with `innerHTML`. The stylesheet's paint reaches its marks, and
`currentColor` or a token follows the dark theme. The same function that makes a shape can place
the elements on it (`left`, `top`), so they follow it. An inline SVG clips to its box; give it
`overflow: visible` for a mark that reaches past its edge. Lines that follow boxes the layout
placed (streams from each source into a store, ribbons out to the uses) are drawn after layout,
by the drawing script (`curve`, `draw` paths from the boxes' points): a before-script runs
before anything has a place.

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

Besides [design.md](design.md)'s list:

- [ ] Every number that matters is written large and drawn to scale beside it
- [ ] The format's sizes hold: nothing under the smallest size its format allows
- [ ] For print: 300 dpi with `--png2x`, bleed when the printer trims, text 35px inside the cut

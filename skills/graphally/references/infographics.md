# Infographics and slides

An infographic makes a few facts land with one reader: a proposal slide, a one-pager, a report
page, a poster, a social image. A diagram explains how a system works; an infographic makes
someone remember and act on a point. Everything in [design.md](design.md) holds for it: the
form, the look, the sizes. This page adds what an infographic needs beyond that: a hero, numbers
drawn to scale, exact page sizes and print.

This reference holds no finished slide on purpose: a designer shown one example reproduces its
features, even its flaws, when asked for something new (Jansson and Smith, *Design Studies*,
1991). Every figure starts from its own content.

## Contents

- [The method](#the-method): the point, the hero, the numbers, the rest
- [Numbers](#numbers): what to draw, and how
- [Techniques](#techniques): page sizes, print, marks from a value, lengths, arcs
- [Before you hand it over](#before-you-hand-it-over)

## The method

1. **The point.** One sentence the reader should take away, in the reader's terms: what they
   gain, with the fact or the safeguard that makes it believable. It may be the title, a line
   set beside the hero, or carried by the hero alone.
2. **The hero.** One form, invented for this content as design.md's [form](design.md#the-form)
   says, that shows the point before a label is read and takes the largest area of the page.
   It is abstract or simplified, never an illustrated scene: shapes, lines, areas and type.
3. **The numbers**, drawn to scale where they are compared with something (below).
4. **The rest.** Supporting facts, callouts with thin leaders to what they name, and, where
   facts are quoted, their source; placed where the design wants them.

## Numbers

- **Draw a number when it is compared with something** (a whole, a before, a target, another
  group): written large and drawn to scale beside it, in the encoding read most accurately,
  position on a common scale and length before angle, area and colour (Cleveland and McGill,
  *JASA*, 1984).
- **Write a number that stands alone.** A count or a duration with nothing to compare (3
  tiers, 30 days, within 90 seconds) is written large and not drawn: a chart of it shows no
  data (Tufte, *The Visual Display of Quantitative Information*, 1983).
- **No pies of many slices**: a segmented bar or a row of marks reads more accurately.
- **A number worked out from the brief** (a payback year, a share of a total) says so beside
  it or in the source note, and is named to the user to confirm.

## Techniques

**The canvas.** The SVG adds a 24px margin around the page, painted with the diagram's
`background`, so a page of W × H pixels is `<diagram width=W-48>` holding one container `H-48`
tall with `position: relative` (and `box-sizing: border-box` when it has padding); regions
inside are placed with grid, flex or `position: absolute`. A 64px margin is the SVG's 24px and
40px of the container's padding. A 16:9 slide of 1600 × 900 is `width=1552` and a container of
852px; 1920 × 1080 is 1872 and 1032; a square post of 1200 × 1200 is 1152 and 1152. A one-pager
of free length lets its height follow the content.

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

## Before you hand it over

Besides design.md's checks, render with `--png1x` and look at the image at full size:

- [ ] The point reads from the hero, in a few seconds
- [ ] The hero belongs to this content: it would not fit another client unchanged
- [ ] Every number that is compared with something is drawn to scale and labelled
- [ ] Quoted facts have their source; worked-out numbers say so

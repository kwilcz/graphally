# Designing a figure

Every figure, a network for a README as much as a slide for a proposal, earns its place the same
way: its form shows the point, and the reader sees what matters before reading a label. The
method and the standard below hold for all of them; a notation (BPMN, a flowchart, UML) keeps its
own rules too, and the method works inside them. Slides, printed pages and posts add their own
sizes and techniques: [infographics.md](infographics.md).

This reference holds no finished figure on purpose: a designer shown one example reproduces its
features, even its flaws, when asked for something new (Jansson and Smith, *Design Studies*,
1991). Every figure starts from its own content.

## Contents

- [The method](#the-method): the point, the hero, the numbers, the rest
- [Inventing the hero](#inventing-the-hero): three candidates, then the one only this content has
- [Moves that make it read](#moves-that-make-it-read): what the research says a reader sees first
- [The standard](#the-standard): the rules a professional figure keeps
- [Building any form](#building-any-form)
- [Before you hand it over](#before-you-hand-it-over)

## The method

1. **The point.** One sentence the reader should take away, in the reader's terms: "every
   spoke's traffic leaves through one firewall", not "network overview"; "payments and packing
   hold up orders", not "order system". A title, when the figure has one, is small and plain and
   may state the point in a few words ("one way in, one way out").
2. **The hero.** One form that shows the point before a label is read, and takes the largest
   area. Invented for this content ([Inventing the hero](#inventing-the-hero)); abstract or
   simplified, never an illustrated scene. In a diagram the hero is often its topology or its
   notation, and then the point is in the emphasis: the one path, gate, boundary or end state
   the point is about takes the accent and the weight, a short callout beside it says why it
   matters ("the only exit"), and the rest stays quiet.
3. **The numbers.** Each number compared with something (a whole, a before, a target, another
   group) is written large and drawn to scale beside it, in the encoding read most accurately:
   position on a common scale and length before angle, area and colour (Cleveland and McGill,
   *JASA*, 1984). A diagram has them too: address ranges side by side on one scale, durations
   on a time axis, the share of traffic each path takes. A count or a duration with nothing to
   compare (3 tiers, 30 days, within 90 seconds) is written large and not drawn: a chart of it
   shows no data (Tufte, *The Visual Display of Quantitative Information*, 1983). A brief with
   no numbers to compare has nothing to draw to scale: the hero carries the point alone.
4. **The rest.** Callouts beside the hero, a key for every colour and line style that means
   something, supporting facts, and a finish at the foot: a note for what the figure leaves out
   or assumes, the source and the owner, all on one grid. Source and owner come from the brief;
   when it names neither, leave them out rather than invent them, and say so to the user.

One figure per point. A brief with several points gets several figures, or one figure whose
sections each carry one.

## Inventing the hero

Sketch three candidates in words before drawing any, one sentence each, each from a different
source, then choose; when two seem equally good, sketch both as rough layouts (SKILL.md,
Sketch) and keep the better. Designers who weigh several ideas side by side reach better and
more varied designs than those who refine their first (Dow et al., *ACM TOCHI*, 2010).

- **From the content's own structure.** Ask what the facts do: something moves through stages,
  splits, accumulates, shrinks, waits, is contained in something larger, is guarded, branches,
  repeats, or is compared with something else. The verb suggests a form: what moves needs a
  route, what accumulates needs a level, what is contained needs a boundary.
- **From the reader's world.** An object, a place, a tool or a document the reader handles every
  day, reduced to a few shapes: its outline, its sections, its scale. The figure then speaks
  their language before it says anything.
- **From the main number.** A form that makes the number felt: a length against the length it
  replaces, a count of marks against the whole, an area filled to the share, a gap left empty.

Starters by what the point is about; the content's own shape is often the best form:

| The point is about | Forms that show it |
|---|---|
| a sequence: what happens, in order | a track with stations; a numbered path laid over the parts; a relay of hand-offs between lanes |
| where things stall or fail | the track with its slow stations marked; a funnel narrowing where cases drop out; a heat tint on the parts |
| layers: what each part is for | the floors of a building; a stack of slabs; a cross-section with callouts |
| ownership: who does what | lanes; a split pyramid with the forums between; a matrix of roles and tasks with filled cells |
| boundaries: in or out | rings of a target; a fence or a wall; a map with borders and territories |
| protection | walls in rings around the crown jewels, with gates on the paths in |
| change: before and after | a split screen with what changes lit up; a bridge from the current state to the target |
| a choice | a fork in the road; a decision tree; a scale weighing the options |
| growth or maturity | a staircase; a rising path with its steps named |
| proportion | sizes that differ on purpose: the big part is drawn big |
| a cycle | a ring of stages with an arrow closing it |
| the parts, where they run, how they communicate | a topology: icons over their names in groups, joined by labelled lines, the point's path in the accent |

Forms combine: a topology with a numbered path over it, a track whose stations are lanes, rings
with a map inside them.

**A topology or a notation as the hero.** When the brief needs every component or every step
drawn (a network, an architecture, a BPMN process), the infographic is in the emphasis. Decide
first which element the point is about: the firewall every route passes, the gateway that
decides, the end states a claim can reach. Give it the accent (a tinted area, a heavier line,
the only coloured mark) and a callout of a few words; keep everything else in ink and the quiet
tints. The notation's shapes stay as the standard draws them.

Then keep the candidate only this content could have. One that would fit another client or
another subject unchanged is generic; drop it, however polished it would look. Give the chosen
form one idea of its own that a reader remembers: a single element in the accent that breaks
the pattern, a boundary that one item crosses, an empty space where something is missing.

## Moves that make it read

Each move rests on research into how people read pictures.

- **One focal point.** The element that carries the point is the strongest: darkest, largest,
  or the only saturated colour; the rest stays quiet (`--wash`, `--lane-a`, `--muted`). A
  single distinct item is found at a glance (pre-attentive processing; Ware, *Information
  Visualization: Perception for Design*, 2021).
- **Grouping explains.** What belongs together shares a band, an area or a tint, and sits
  close; a container says "part of" without a line (proximity, similarity and common region;
  Palmer, *Cognitive Psychology* 24, 1992).
- **The form means something.** A pyramid for seniority, rings for certainty, a track for
  order, floors for layers: the reader infers the meaning from the shape (semantic
  transparency; Moody, "The Physics of Notations", *IEEE TSE* 35, 2009).
- **Every visual variable carries meaning.** Position, size, shape, colour, value and texture
  (dashed, struck through) each say something; a figure that uses only boxes and lines speaks
  with two of them (Bertin, *Semiology of Graphics*, 1967; Moody's visual expressiveness).
- **Labels sit by what they name.** Every mark that means something has a short label beside
  it, and a number that matters is written large (spatial contiguity; Mayer, *Multimedia
  Learning*, 2009).
- **One reading direction.** Left to right or top to bottom, with the steps numbered when their
  order matters.
- **Every mark explains.** Frames, lines and colours each carry a meaning or go (coherence;
  Mayer, 2009). An item of a topology is a `figure`: its icon over its name, no frame.

## The standard

These rules hold for every figure; designers and the research agree on them (one or two main
colours and an accent, two fonts at most, one icon style: Visme's infographic design guide;
pictograms and titles drive recall: Borkin et al., *IEEE TVCG*, 2013 and 2016).

- **One hero**, larger than anything else, carrying the point.
- **One plain family**: Inter, IBM Plex Sans with Plex Mono, or Arimo (Arial's metrics), the
  client's own when it has one; weight and size carry the hierarchy. A display face only when
  the user or the brand guide asks for one ([fonts.md](fonts.md)).
- **A small, plain title, or none**: the diagram's `title` (15px) or a 15 to 18px line in the
  family's semibold at the top left, naming the subject or stating the point in a few words. No
  line of small capitals above it, no coloured words in it, no sentence-long lead under it.
  Where the page around the figure names it, leave the title out.
- **Nothing the brief does not say**, unless it is marked as assumed: a technical detail from
  general knowledge (SNAT on the firewall, a SKU, a region read from a name) is left out or
  labelled "assumed", and named to the user.
- **Sizes for where it is read.** A figure in a page (a README, a wiki, a report) is shown at
  most about 880px wide: a wider one is scaled down, so at 1000 to 1400 wide its labels are 15
  to 17px, 13px at the least (`:root { --text-size: 16px }` raises every default size together,
  line labels included), and one that fits in 880 is shown at its size. Make it no wider
  than its content needs (a tall flowchart is often narrower than 880); rather than a wider
  figure, make the layout compact. Slides, print and posts: [infographics.md](infographics.md).
- **Two or three colours on a neutral ground**: the client's brand colours when it has them.
  Two exceptions: one colour per source or path when the figure follows them through (below),
  and cloud service icons, which keep their own colours and do not count. Without a brand, take
  the palette from the subject or the reader's world (a bank's ink and paper, a safety colour
  for operations, a sector's own convention), with one main colour and one accent for what
  matters most. A colour means one thing throughout: decide what each one stands for before
  using it, and name it in the key. Text keeps a contrast of 4.5:1 with its ground, 3:1 when
  large (WCAG 2.2, 1.4.3).
- **One icon style**: the client's own set, or line icons in one weight, or cloud service icons
  where the figure is about those services: [icons.md](icons.md). The service icons count as one
  style and keep their colours; where those colours compete with the accent, draw the services
  with line icons instead.
- **A grid and air**: equal outer margins, aligned edges, white space between groups; nothing
  touches, nothing floats.
- **Comparisons drawn, not only written**, each with its numeral beside the drawing. No pies of
  many slices.
- **Nothing looks measured that isn't.** Bars of different lengths, a pie's slices, a filled
  level and an area read as quantities: draw them only from a number the brief gives.
  Illustrative marks (records, examples, a crowd) are alike in size, and a note says they are
  not counts.
- **What the point follows keeps its look.** When the figure traces things from where they
  start to where they end (sources into reports, steps through stages, traffic through a
  firewall), each keeps one colour or one mark shape all the way, so the reader follows it
  without a legend; a mark that loses its identity at a boundary loses the point there.
- **A guided eye**: one reading path, or steps numbered in reading order; thin leaders from
  callouts to what they name.
- **A finish**: a note for what the figure leaves out or assumes, a source note for every figure
  quoted, the owner where the brief names one. A number worked out from the brief (a payback
  year, a share of a total) says so in the note, and is named to the user to confirm.

What makes a figure look generated rather than designed, to leave out: rows of white cards with
shadows, a tile per number, a gradient hero, emoji, everything centred, more than three colours,
clip-art scenes, text in boxes where a drawn number would do, and a figure where every element
weighs the same.

## Building any form

| To build | Use |
|---|---|
| areas, alignment, rows across stages | grid, `grid-template-areas`, subgrid (`charts.md`, `network.md`) |
| a shape | `shape=` (chevron, hexagon, semicircle, trapezoid, cylinder …) or `clip-path: polygon(…)` for any straight-edged one (`documents.md`) |
| a position no grid gives | a before-script that sets `left` and `top` (`documents.md`, placing by angle) |
| a mark with no box | the drawing script around elements the layout placed: `draw` paths, `draw.arc`, `text`, `icon`, `shape` (`format.md`, The script) |
| a callout | a short line of text beside its mark, in the page's grid, or `text()` with a thin leader drawn to the mark |
| a scale | a row of marks sized `calc(var(--v) / max * 100%)` on one axis (`infographics.md`, Lengths to scale) |

Some forms, built:

- **A road**: a band cut by `clip-path` along a grid row, numbered stops on it, the stations as
  figures above and the notes below (the second example in `SKILL.md`).
- **A building**: a `trapezoid` roof over floors stacked as bands, each floor naming its layer
  and holding its parts.
- **Walls**: circles (`border-radius: 50%`) stacked in one grid cell, the protected thing at the
  centre and gates drawn on the paths in.
- **A split screen**: two panels in one grid on the same layout, the changed items `accent`, the
  removed ones struck through (`line-through`).
- **A funnel**: bands that narrow row by row (`clip-path`), the count at each step written large
  beside it.
- **An emphasised element in a topology**: its group tinted with the accent at about 10% opacity
  (`rgb(178 59 31 / 10%)`, which follows the dark theme where `color-mix()` does not), its border
  in the accent token, its lines `"color"` the same token, and a `<small>` callout under its name.

## Before you hand it over

Render with `--png1x` and look at the image at full size, as the reader will:

- [ ] The point reads from the hero alone, in a few seconds; one element draws the eye first
- [ ] The hero belongs to this content: it would not fit another client unchanged
- [ ] Numbers that compare are drawn to scale and labelled; counts are written, not drawn
- [ ] Every colour and line style that means something is in the key; callouts sit by their marks
- [ ] One plain family; a small, plain title or none; two or three colours on a neutral ground
  (or one per source, when the figure follows sources); one icon style
- [ ] Margins are equal, edges align, nothing touches or overflows
- [ ] Sources, owner and details as the brief gives them; none invented, assumptions marked
- [ ] The render prints ok, or only warnings you meant

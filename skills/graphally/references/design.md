# Designing a figure

A figure earns its place when its form shows the point: the reader sees what matters before
reading a label. The default is a **professional diagram**, in the register of good technical
documentation (a cloud vendor's architecture centre, a process handbook, a specification): the
notation's rules kept, the page's own ground, one plain typeface, a small title or none, and
labels rather than sentences. Within that register, each figure gets the layout, shapes and
colours its content needs. Display type, headlines that argue a point, pictorial forms and
grounds of the figure's own belong to infographics and slides ([infographics.md](infographics.md)),
or to a user who asks for them.

## Contents

- [The register](#the-register): standards first; a diagram, not a poster
- [The point](#the-point): one sentence, and a title only when it helps
- [The form](#the-form): the notation, or three candidates; abstract, not illustrated
- [Moves that make it read](#moves-that-make-it-read): the research behind a glanceable figure
- [The look](#the-look): ground, type, labels, shapes, lines, colour
- [Sizes for where it is read](#sizes-for-where-it-is-read)
- [Building any form](#building-any-form)
- [Pitfalls](#pitfalls)
- [Before you hand it over](#before-you-hand-it-over)

## The register

- **Standards first.** Where the figure has a notation, keep its rules exactly and design inside
  them: BPMN 2.0 for process models and flowchart symbols for flowcharts
  ([process.md](process.md)), UML for sequence diagrams ([sequence.md](sequence.md)), the
  vendors' icons and grouping for cloud architecture ([network.md](network.md)), a Gantt chart
  for a plan ([plan.md](plan.md)). Readers who know a notation read it at once; experts read a
  conventional notation faster and more accurately than an invented one (cognitive fit: Vessey,
  *Decision Sciences* 22, 1991; Moody, "The Physics of Notations", *IEEE TSE* 35, 2009).
- **A diagram, not a poster.** A diagram is read beside a text, often more than once, to find
  something out, so it is calm, consistent and complete. Decoration helps a figure be
  remembered (Bateman et al., CHI 2010), which is an infographic's job; in a diagram, a mark
  that carries no information is noise (Tufte, *The Visual Display of Quantitative
  Information*, 1983).

## The point

- **One sentence** the reader should come away with, in their words: "payments and packing
  hold up orders", rather than "order system overview". The figure carries it: the layout,
  the emphasis and the colour show it; no headline argues it.
- **A title only when it helps.** Most figures need none: the heading or caption of the
  document around them names them. When one helps (a figure met alone, a page of several),
  give `title` on `<diagram>`, which the theme sets small: a plain name of the subject and the
  kind, "Expense claim process", "Order platform on Azure: production" (the C4 model's advice:
  a title names the diagram's type and scope). `subtitle` holds scope the figure cannot show
  (an environment, a date, a version), not a sentence about it. A large title belongs to an
  infographic, a slide, or a user who asks for one.
- **One figure per point.** A brief with several points gets several figures, or one figure
  whose sections each carry one.

## The form

Where the figure has a notation (BPMN, a flowchart, a UML sequence, a topology of cloud
services, a Gantt chart), the notation is the form: keep it, and arrange it around the point.
Otherwise, sketch three candidates in words before drawing any, each from a different source,
then choose. Designers who weigh several ideas side by side reach better and more varied designs
than those who refine their first (Dow et al., *ACM TOCHI*, 2010).

- **From the content's own structure.** Ask what the things do: move through stages, split,
  merge, accumulate, wait, sit inside something larger, are shared, branch, repeat, or are
  compared. The verb suggests the form: what moves needs a track, what merges needs streams,
  what is contained needs a boundary, what is shared needs an overlap.
- **From a convention the reader knows**: a waterfall for a cost bridge, a matrix of roles and
  tasks, rings for what is in and out, two panels for before and after. Readers infer the
  meaning from a familiar shape (Moody, 2009).
- **From the main number,** when there is one: a length against the length it replaces.

Keep the candidate that shows this content best. One that would fit any other subject
unchanged is generic: three columns of identical cards fit every subject, and show none.

| The point is about | Forms that show it |
|---|---|
| a sequence: what happens, in order | a flowchart; a track with stations; a relay of hand-offs between lanes |
| where things stall or fail | the track with its slow stations marked; a funnel narrowing where cases drop out |
| where things come from and go to | streams merging into a store and leaving it; stages the records pass through |
| layers: what each part is for | a stack of slabs; a cross-section |
| ownership: who does what | lanes; overlapping territories with what is shared in the overlap; a matrix |
| boundaries: in or out | rings; nested regions; a line with what is outside it |
| change: before and after | two panels on one layout, the changes marked; a waterfall from one total to the other |
| a hierarchy | a tree; a stepped stack, the senior level on top |
| a cycle or a repeat | a ring of stages; a loop drawn around the steps that repeat |
| the parts, where they run, how they communicate | a topology: icons over their names in regions, joined by labelled lines |

- **Arrange it around the point.** The main path runs straight and central, its branches beside
  it; what belongs together shares a region; the reading runs one way; the element that carries
  the point is the strongest. Give the figure one structural idea a reader remembers: the overlap
  where both parties sit, the loop around the steps that repeat, the one line that crosses a
  boundary.
- **Abstract, not illustrated.** Build the form from geometry (regions, bands, overlaps, rings,
  tracks, lines, a scale), so it reads as a diagram. An illustration (water in a lake, a building
  with a roof, price tags on strings, chairs round a table) belongs to an infographic.

## Moves that make it read

Each move rests on research into how people read pictures.

- **One focal point.** The element that carries the point is the strongest: darkest, largest,
  or in the accent; the rest stays quieter. A single distinct item is found at a glance
  (pre-attentive processing; Ware, *Information Visualization: Perception for Design*, 2021).
- **Grouping explains.** What belongs together shares a band, an area or a tint, and sits
  close; a region says "part of" without a line (proximity, similarity and common region;
  Palmer, *Cognitive Psychology* 24, 1992).
- **Every visual variable carries meaning.** Position, size, shape, colour, value and texture
  (dashed, struck through) each say something (Bertin, *Semiology of Graphics*, 1967).
- **Labels sit by what they name** (spatial contiguity; Mayer, *Multimedia Learning*, 2009).
- **One reading direction.** Left to right or top to bottom, with the steps numbered when their
  order matters.
- **Every mark explains.** Frames, lines and colours each carry a meaning or go (coherence;
  Mayer, 2009).

## The look

The reader gets the overview at a glance, and the figure looks professional: calm,
consistent, and conventional where a convention exists. Professional is not plain: a figure of
white boxes in grey groups, with nothing strong, reads as a draft. It has distinct shapes for
distinct roles, a tint for each region by what the region is, the main path heavier than the
rest, one element that draws the eye, and a layout that fills its width with no empty corner.

- **The page's ground.** Draw on the theme's page, with regions as tints of it, so the figure
  sits in the document and follows its dark theme. No paper colour, dark panel or gradient
  behind the figure; a brand's background only when its guide asks for one.
- **One plain typeface.** The theme's Inter, or another standard face: Arial (its metric twin
  Arimo is embedded), the client's brand face, or a plain serif where the document is set in
  one ([fonts.md](fonts.md)). One family: weight and size carry the hierarchy, in two or
  three sizes, with a monospace for commands and code. Set the lines' labels in it with
  `--line-label-font` ([format.md](format.md), Connections).
- **Labels, not sentences.** A name, and under it a few words; the explanation belongs in the
  text around the figure. A short note may say what the figure assumes or leaves out.
- **Shapes by role.** Where a notation fixes the shapes (BPMN, flowchart symbols, UML), keep
  them; the look then comes from the lanes, the weight of the main path and the space. Elsewhere
  let the shape say what a thing is: an icon over its name for a component, a band or a tinted
  region for an area, a pill for an actor or a state. Frame a thing only where the frame means
  a boundary. A figure of identical white cards reads as a form to fill in. A region's name is
  text on the region's tint (semibold, or small capitals), not a filled bar: solid colour is
  for the element that carries the point.
- **Lines that follow the content.** A flow, a call path or a sequence runs on straight, routed
  lines; streams that merge or split may curve into each other. Weight and dash carry meaning
  (a thicker line for the main path, a dashed one for what is asynchronous), and the figure
  says which, in its key or in the label of the path. One weight for one meaning, the same for
  every line that has it. Curves are drawn in the page (an inline SVG) or by `curve`.
- **Colour that carries detail.** Neutral ink for the structure; a tint per lane, zone, owner
  or path; a strong colour for what carries the point. `--rust`, the theme's red, means failure,
  danger or a stop, and `--green` success; for emphasis take `--woad`, `--teal` or `--purple`. As many colours as the figure has meanings, each meaning one thing throughout.
  Vendor icons keep their own colours; brand colours come first when there are some. Text
  keeps a contrast of 4.5:1 with its ground, 3:1 when large (WCAG 2.2, 1.4.3).
- **Air and alignment.** Equal outer margins, aligned edges, white space between groups;
  nothing touches, nothing floats.
- **Accurate before persuasive.** Every component and connection the brief names is drawn,
  and a label claims only what the brief says. Where the brief is silent on what its kind of
  figure conventionally shows (the subnets of a VNet), follow that kind's reference and say
  what is assumed. A number worked out from the brief is marked as an estimate and named to the
  user to confirm.

What looks unprofessional: a headline that argues a point, with coloured words, a small
capitals line above it and a sentence under it; display serifs and condensed poster faces; a
paper-coloured sheet or a dark panel behind the figure; a picture standing in for the
structure; big numbers in a figure that is not about numbers; paragraphs inside the figure. And
at the other end: rows of identical white cards with shadows, everything boxed and centred,
colour that means nothing, gradients, emoji, clip-art.

## Sizes for where it is read

| Where | Width | Text |
|---|---|---|
| in a page (a README, a wiki, a report), shown at 700 to 900px | `width` 1000 to 1400 | labels 15 to 17px, nothing under 13px |
| a slide on a screen | 1600 × 900 | labels 16 to 20px, nothing under 12px |
| printed (A4 or Letter) | 1240 across portrait, 1754 landscape | a point is about 2px: labels 18 to 22px, nothing under 14px |

A figure in a page is shrunk to the page's column: in a README it shows at most about 880px
wide, so its text shows at its size × 880 ÷ `width`. Keep that at 11px or more: labels of 13px
fit a figure 1000 wide, 15px one 1200 wide, 17px one 1400 wide (Butterick, *Practical
Typography*: body text on screens 15 to 25px). The building blocks' text starts at 11.5 to
13px, so set it for the width: `.figure, .node, [shape] { font-size: 15px }`, their `small`
lines 13px, `h4` 14px, a sequence's `.msg` 15px, and `--line-label-font`. Rather than a wider
figure with larger text, make the layout more compact: wrap a long row, shorten labels.
Slides, social images and print production: [infographics.md](infographics.md).

## Building any form

| To build | Use |
|---|---|
| areas, alignment, rows across stages | grid, `grid-template-areas`, subgrid (`charts.md`, `network.md`) |
| a shape | `shape=` (the notations' shapes, chevron, cylinder …) or `clip-path: polygon(…)` (`documents.md`) |
| a position no grid gives | a before-script that sets `left` and `top` (`documents.md`) |
| streams, a scale, a field the page sits on | an inline `<svg>` placed first in its region, filled by a before-script; `overflow: visible` for a mark past its edge |
| a mark with no box | the drawing script: `draw` paths, `curve`, `draw.arc`, `text`, `icon`, `shape` (`format.md`) |

Some forms, built:

- **Swimlanes**: full-width subgrid rows, the lane's name in the first column, one column per
  step ([process.md](process.md)).
- **A layered stack**: bands in one grid column, each naming its layer at the left, the
  components of the layer in a row inside it; what runs through every layer as a column
  beside the stack.
- **Nested regions**: `group` inside `group`, each with its `<h4>`; a scope boundary as one
  heavier outline with what is out of scope outside it.
- **Two panels**: one grid holding both states on the same layout, the changed items in the
  accent, the removed ones struck through.
- **Sources into stages**: sources down one side, lines (or curves in an inline SVG) into the
  first stage, the stages as columns or chevrons, the uses at the far side.

## Pitfalls

- **Class names the building blocks use** (`num`, `card`, `pill`, `tag`, `badge`, `tile`,
  `box`, `banner`, `swatch` and the others `format.md` lists): a class of yours with one of
  these names keeps the block's look where your rule does not speak; the render warns
  `class-taken`. Name yours differently.
- **Names the drawing script defines** (`el`, `all`, `pt`, `mid`, `lerp`, `draw`, `arrow`,
  `curve`, `connect`, `depend`, `text`, `icon`, `shape`, `gate`, `animate`): a `const curve` of
  your own is a script error.
- **`<i>` is italic** in the browser's stylesheet: set `font-style: normal` on one that holds text.
- **A face the diagram does not load** (in `fonts`, or with `@font-face`) falls back to the
  theme's font, and the measurements change with it.
- **The drawing script paints over the page**: what must sit on a drawn mark belongs in the page
  (an inline SVG under it), or is drawn by the script after the mark.
- **A plain `1fr` stretches to its content**: proportional grids take `minmax(0, …fr)`.

## Before you hand it over

Render with `--png1x` and look at the image at the size the reader will see it:

- [ ] The notation's rules hold: its shapes, its lines, its labels
- [ ] The overview reads at a glance, from the layout, before the labels
- [ ] A small title or none; no headline, no line above it, no sentence under it
- [ ] One plain typeface on the page's ground; labels, not sentences
- [ ] Shapes, lines and colours each mean something; nothing decorates
- [ ] Every component and connection the brief names is there; nothing claims more than it says
- [ ] The text is large enough for where it is read; margins are equal; nothing touches
- [ ] The render prints ok, or only warnings you meant

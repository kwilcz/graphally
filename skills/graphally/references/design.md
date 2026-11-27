# Designing a figure

A figure earns its place when its form shows the point: the reader sees what matters before
reading a label. This page holds what every figure shares, whatever its kind: the point, the
form invented for it, the moves that make it read at a glance, and the look that makes it
designed rather than generated. The other references hold the techniques that build any form;
whatever a page can lay out renders.

## Contents

- [The point](#the-point)
- [The form](#the-form): three candidates, then the one only this content has
- [Moves that make it read](#moves-that-make-it-read): the research behind a glanceable figure
- [The look](#the-look): shapes, lines, colour, type, and what looks generated
- [Sizes for where it is read](#sizes-for-where-it-is-read)
- [Building any form](#building-any-form)
- [Pitfalls](#pitfalls)
- [Before you hand it over](#before-you-hand-it-over)

## The point

- **One sentence** the reader should come away with, in their words: "payments and packing
  hold up orders", rather than "order system overview".
- **The figure carries it.** A title that states the point helps a reader who meets the
  figure alone; a figure under a heading that already says it may need none. Whether there is a
  title, a lead line or neither, and where they sit (across the top, in a corner, down the
  side, inside the drawing), is a design choice for this figure.
- **One figure per point.** A brief with several points gets several figures, or one figure
  whose sections each carry one.

## The form

Sketch three candidates in words before drawing any, each from a different source, then choose.
Designers who weigh several ideas side by side reach better and more varied designs than those
who refine their first (Dow et al., *ACM TOCHI*, 2010).

- **From the content's own structure.** Ask what the things do: something moves through stages,
  splits, merges, accumulates, waits, is contained in something larger, is guarded, branches,
  repeats, or is compared with something else. The verb suggests a form: what moves needs a
  route, what merges needs streams, what accumulates needs a level, what is contained needs a
  boundary.
- **From the reader's world.** An object, a place or a tool the reader handles every day,
  reduced to a few shapes. The figure then speaks their language before it says anything.
- **From the main number,** when there is one: a form that makes it felt (a length against the
  length it replaces, a count of marks against the whole).

Keep the candidate that shows this content best; one that would fit any other subject unchanged
is generic. A form people already read a certain way is often the best one: readers infer the
meaning from a familiar shape (semantic transparency; Moody, "The Physics of Notations", *IEEE
TSE* 35, 2009). Starters, a few of many:

| The point is about | Forms that show it |
|---|---|
| a sequence: what happens, in order | a track or road with stations; a numbered path laid over the parts; a relay of hand-offs between lanes |
| where things stall or fail | the track with its slow stations marked; a funnel narrowing where cases drop out; a heat tint on the parts |
| where things come from and go to | streams merging into a store and leaving it; records changing shape stage by stage |
| layers: what each part is for | the floors of a building; a stack of slabs; a cross-section with callouts |
| ownership: who does what | lanes; a split pyramid with the forums between; a matrix of roles and tasks |
| boundaries: in or out | rings of a target; a fence or a wall; a map with borders and territories |
| change: before and after | a split screen with what changes lit up; a bridge from the current state to the target |
| a choice | a fork in the road; a decision tree; a scale weighing the options |
| a cycle or a repeat | a ring of stages; a loop drawn around the steps that repeat |
| the parts, where they run, how they communicate | a topology: icons over their names in regions, joined by labelled lines |

Forms combine: a topology split into lanes by path, a grid of roles with the repeating steps
looped, rings with a map inside them. Give the figure one idea a reader remembers: the loop
around the steps that repeat, the one line that crosses a boundary, an empty space where
something is missing.

## Moves that make it read

Each move rests on research into how people read pictures.

- **One focal point.** The element that carries the point is the strongest: darkest, largest,
  or in the accent; the rest stays quieter. A single distinct item is found at a glance
  (pre-attentive processing; Ware, *Information Visualization: Perception for Design*, 2021).
- **Grouping explains.** What belongs together shares a band, an area or a tint, and sits
  close; a region says "part of" without a line (proximity, similarity and common region;
  Palmer, *Cognitive Psychology* 24, 1992).
- **The form means something.** A pyramid for seniority, rings for certainty, a track for order,
  floors for layers: the reader infers the meaning from the shape (Moody, 2009).
- **Every visual variable carries meaning.** Position, size, shape, colour, value and texture
  (dashed, struck through) each say something; a figure of boxes and lines speaks with two of
  them (Bertin, *Semiology of Graphics*, 1967).
- **Labels sit by what they name,** and a number that matters is written large (spatial
  contiguity; Mayer, *Multimedia Learning*, 2009).
- **One reading direction.** Left to right or top to bottom, with the steps numbered when their
  order matters.
- **Every mark explains.** Frames, lines and colours each carry a meaning or go (coherence;
  Mayer, 2009).

## The look

The reader should get the overview at a glance, before reading a word, and the figure should
look designed: distinct, calm and clear.

- **Shapes chosen by role, not rows of rectangles.** Let the shape say what a thing is: a
  chevron for a stage, a pill or a circle for an actor or an item, a band or a tinted region for
  an area, small marks (dots, squares, triangles) for records, a loop for what repeats. Frame a
  thing only where the frame means a boundary; set text on a tinted ground rather than in a card.
  A figure of identical white boxes reads as a form to fill in, not as a picture. Where a
  notation fixes the shapes (BPMN, UML), keep them: the look then comes from the tinted lanes,
  the weight of the main path, the type and the space around them.
- **Lines that follow the content.** Streams that merge or split curve into each other; a call
  path, a sequence or a BPMN flow keeps straight, routed lines. Weight and dash carry meaning (a
  thick line for the main path, a dashed one for what happens later or asynchronously), and the
  figure says which: in its key, or in the label of the path they mark. One weight for one
  meaning, the same for every line that has it; a line made heavier only for emphasis reads as a
  mistake. A line's arrowhead grows with its width. Curves and streams are drawn in the page (an
  inline SVG) or by the drawing script's `curve`.
- **Colour that carries detail.** Use as many colours as the figure has meanings, and let each
  colour mean one thing throughout: a tint per lane, team, zone or path, a strong accent for
  what matters most. Tinted grounds behind regions add contrast and say "these belong together";
  a coloured page ground is fine. Vendor icons keep their own colours. Brand colours come first
  when there are some; otherwise take the palette from the subject. Text keeps a contrast of
  4.5:1 with its ground, 3:1 when large (WCAG 2.2, 1.4.3).
- **Type with a hierarchy.** Two typefaces at most, a display face for the headings and the big
  numbers and a text face for the rest, or one family in two weights; the client's own when it
  has one ([fonts.md](fonts.md)). A monospace of the same family for commands and code
  (IBM Plex Mono beside Plex Sans) counts as that family. Sizes follow where the figure is read (below). Set the lines'
  labels in the same type with `--line-label-font` ([format.md](format.md), Connections).
- **Air and alignment.** Equal outer margins, aligned edges, white space between groups;
  nothing touches, nothing floats.
- **Accurate before persuasive.** In a technical figure, every component and connection the
  brief names is drawn, and a title or a label claims only what the brief says. Where the brief
  is silent on what its kind of figure conventionally shows (the subnets of a VNet), follow
  that kind's reference and say what is assumed. Where the
  figure leaves something out that a reader might look for, or draws marks that are
  illustrative rather than counted, a short note says so. A number worked out from the brief
  is marked as an estimate and named to the user to confirm.
- **A finish, where it helps.** A source note for quoted facts, an owner or a date: placed
  where the design wants them, or left out when the figure lives in a page that carries them.

What makes a figure look generated rather than designed: rows of identical white cards with
shadows, everything in boxes, everything centred, a colour that means nothing, a gradient for
its own sake, emoji, clip-art scenes, text in a box where a drawn shape would say it.

## Sizes for where it is read

| Where | Width | Text |
|---|---|---|
| in a page (a README, a wiki, a report), shown at 700 to 900px | `width` 1000 to 1400 | labels 16 to 18px, nothing under 14px |
| a slide on a screen | 1600 × 900 | headings 48 to 72px, labels 16 to 20px, sentences 15 to 17px, nothing under 12px |
| printed (A4 or Letter) | 1240 across portrait, 1754 landscape | a point is about 2px: sentences 20 to 24px, nothing under 14px |
| a social feed | 1200 × 1200 or 1200 × 627 | shown at a third to half: sentences 28px or more, nothing under 24px |

A figure in a page is shrunk to the page's column, so its text starts larger than a slide's
would at the same width (Butterick, *Practical Typography*: body text on screens 15 to 25px;
in print 10 to 12pt). Exact page sizes, bleed and print production: [infographics.md](infographics.md).

## Building any form

| To build | Use |
|---|---|
| areas, alignment, rows across stages | grid, `grid-template-areas`, subgrid (`charts.md`, `network.md`) |
| a shape | `shape=` (chevron, hexagon, semicircle, trapezoid, cylinder …) or `clip-path: polygon(…)` for any straight-edged one (`documents.md`) |
| a position no grid gives | a before-script that sets `left` and `top` (`documents.md`, placing by angle) |
| streams, a route, a field the page sits on | an inline `<svg>` placed first in its region, filled by a before-script (`innerHTML`); the same function places the elements on it; `overflow: visible` for a mark past its edge |
| a mark with no box | the drawing script around elements the layout placed: `draw` paths, `curve`, `draw.arc`, `text`, `icon`, `shape` (`format.md`, The script) |

Some forms, built:

- **A road**: a band cut by `clip-path` along a grid row, numbered stops on it, the stations
  above and the notes below.
- **A building**: a `trapezoid` roof over floors stacked as bands, each floor naming its layer.
- **Walls**: circles (`border-radius: 50%`) stacked in one grid cell, the protected thing at the
  centre and gates drawn on the paths in.
- **A split screen**: two panels in one grid on the same layout, the changed items in the
  accent, the removed ones struck through.
- **Streams into a store**: sources down one side, curved strokes in an inline SVG from each
  into the store, the store's stages as chevrons, the outlets curving away.

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

- [ ] The overview reads at a glance, from the form, before the labels
- [ ] Shapes, lines and colours each mean something; no rows of identical boxes
- [ ] Every component and connection the brief names is there; nothing claims more than it says
- [ ] The text is large enough for where it is read; margins are equal; nothing touches
- [ ] The render prints ok, or only warnings you meant

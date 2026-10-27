# Designing a figure

A figure earns its place when its form shows the point: the reader sees what matters before
reading a label. This page serves step 1 of the workflow: the point, the visual metaphor,
and the moves that make a figure read at a glance. The other references hold the
techniques that build any form; whatever a page can lay out renders.

## The point

- **One sentence** the reader should come away with, in their words: "payments and packing
  hold up orders", rather than "order system overview".
- **The title states it**; the subtitle gives the context (whose, where, when).
- **One figure per point.** A brief with several points gets several figures, or one figure
  whose sections each carry one.

## The visual metaphor

Ask what the point is about, then find a form people already read that way. These are
starters, a few of many; the content's own shape is often the best form, so draw that.

| The point is about | Forms that show it |
|---|---|
| a sequence: what happens, in order | a track or road with stations; a numbered path laid over the parts; a relay of hand-offs between lanes |
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
| what runs where, what talks to what | a topology: icons over their names in groups, joined by labelled lines |

Forms combine: a topology with a numbered path over it, a track whose stations are lanes,
rings with a map inside them.

## Moves that make it read

Each move rests on research into how people read pictures.

- **One focal point.** The element that carries the point is the strongest: darkest,
  largest, or the only saturated colour; the rest stays quiet (`--wash`, `--lane-a`,
  `--muted`). A single distinct item is found at a glance (pre-attentive processing; Ware,
  *Information Visualization: Perception for Design*, 2021).
- **Grouping explains.** What belongs together shares a band, an area or a tint, and sits
  close; a container says "part of" without a line (proximity, similarity and common
  region; Palmer, *Cognitive Psychology* 24, 1992).
- **The form means something.** A pyramid for seniority, rings for certainty, a track for
  order, floors for layers: the reader infers the meaning from the shape (semantic
  transparency; Moody, "The Physics of Notations", *IEEE TSE* 35, 2009).
- **Every visual variable carries meaning.** Position, size, shape, colour, value and
  texture (dashed, struck through) each say something; a figure that uses only boxes and
  lines speaks with two of them (Bertin, *Semiology of Graphics*, 1967; Moody's visual
  expressiveness).
- **Labels sit by what they name.** Every mark that means something has a short label
  beside it, and a number that matters is written large (spatial contiguity; Mayer,
  *Multimedia Learning*, 2009).
- **One reading direction.** Left to right or top to bottom, with the steps numbered when
  their order matters.
- **Every mark explains.** Frames, lines and colours each carry a meaning or go (coherence;
  Mayer, 2009). An item of a topology is a `figure`: its icon over its name, no frame.

## Building any form

| To build | Use |
|---|---|
| areas, alignment, rows across stages | grid, `grid-template-areas`, subgrid (`charts.md`, `network.md`) |
| a shape | `shape=` (chevron, hexagon, semicircle, trapezoid, cylinder …) or `clip-path: polygon(…)` for any straight-edged one (`documents.md`) |
| a position no grid gives | a before-script that sets `left` and `top` (`documents.md`, placing by angle) |
| a mark with no box | the drawing script around elements the layout placed: `draw` paths, `draw.arc`, `text`, `icon`, `shape` (`format.md`, The script) |

Some forms, built:

- **A road**: a band cut by `clip-path` along a grid row, numbered stops on it, the
  stations as figures above and the notes below (the second example in `SKILL.md`).
- **A building**: a `trapezoid` roof over floors stacked as bands, each floor naming its
  layer and holding its parts.
- **Walls**: circles (`border-radius: 50%`) stacked in one grid cell, the protected thing at
  the centre and gates drawn on the paths in.
- **A split screen**: two panels in one grid on the same layout, the changed items
  `accent`, the removed ones struck through (`line-through`).
- **A funnel**: bands that narrow row by row (`clip-path`), the count at each step written
  large beside it.

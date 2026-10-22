# Figures in HTML and CSS

`<diagram layout=html>` draws any figure that is not a plain graph: phase and role charts,
matrices, step cards, roadmaps, BPMN processes with a layout of your own, one-page
overviews, several kinds in one figure. You write the figure as a web page; the browser
places every box and wraps every line; graphally turns the page into SVG. The connections
are data: a JSON list of who connects to whom, routed around the boxes. A `<script>` draws
anything else by name: arrows, gates on a column boundary, lines computed in a loop.
Nothing in the source is a coordinate.

```html
<diagram layout=html width=1000>
<style>
  .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px; align-items: center; justify-items: center }
  .ev { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11.5px }
</style>
<div class="flow">
  <div class="ev"><i shape=start id=in></i>Order placed</div>
  <div shape=task id=check>Check stock</div>
  <i shape="gateway exclusive" id=ok></i>
  <div shape=cylinder id=db>Orders DB</div>
</div>
<script type="application/json">
[
  ["in", "check"],
  ["check", "ok"],
  { "from": "ok", "to": "db", "label": "in stock" }
]
</script>
</diagram>
```

## The page

- `width` on `<diagram>` sets the page width (default 1200); the SVG adds a 24px margin on
  each side. The height follows the content.
- Any CSS for layout works: grid (with `grid-column: span 2`, `subgrid`), flexbox,
  `position: absolute` inside a `position: relative` box, margins, padding.
- What is drawn: background colours, borders (solid, dashed, dotted, per side),
  `border-radius`, `clip-path: polygon(…)`, shapes, text with its font, size, weight,
  style, colour, `text-transform` and `letter-spacing`, list bullets, and `<icon>`.
- What is not drawn: shadows, gradients, transforms, rotated or vertical text, images,
  `::before` and `::after`. Draw such marks in the script instead.
- Colours: any CSS colour, or the theme tokens, which follow the dark theme: `var(--ink)`
  (text), `--muted`, `--line`, `--card` (white), `--wash`, `--bg`; strong `--woad` (blue),
  `--rust` (red), `--teal`, `--green`, `--purple`, `--amber`; pale `--lane-a` (blue),
  `--lane-b` (green), `--lane-c` (purple), `--lane-d` (orange). Literal colours stay as
  written in both themes.
- `title` and `subtitle` on `<diagram>` add the standard heading; or write your own `<h1>`.

## Shapes

`shape="…"` on any element draws it as that shape. The element is still a box in the
layout, sized by its content and your CSS; its background is the shape's fill and its
border the outline (`border-style: dashed` dashes it). By default a shape has a white fill,
a 1.5px ink outline and centred content. For a filled bar, set `border: 0` and a background.

| Shapes | |
|---|---|
| `rect`, `rounded`, `stadium` (`pill`, `terminator`), `ellipse`, `circle` | basic |
| `diamond` (`decision`), `hexagon`, `triangle`, `parallelogram` (`io`), `trapezoid` | geometric |
| `chevron`, `chevron-start` | phase bars: a notch and a point; a flat start and a point |
| `arrow-right`, `arrow-left`, `arrow-up`, `arrow-down` | block arrows |
| `cylinder` (`database`, `data-store`), `cylinder-h` (`queue`) | stores |
| `document`, `documents`, `note` (`data-object`), `callout`, `cloud` | documents and notes |
| `manual-input`, `predefined`, `delay`, `off-page` | flowchart |
| `task`, `subprocess`, `start`, `event`, `end`, `gateway` | BPMN |
| `cycle` (`repeat`, `loop`) | a repeat badge: a ring with two chasing arrows, 28px |

Markers follow the shape name: `gateway exclusive` (×), `gateway parallel` (+),
`gateway inclusive` (○); `start`, `event` or `end` with `timer`, `message`, `signal` or
`error`, and `end terminate`; `task loop`, `task multi`, `subprocess loop`. Events are 36px
(`end` has a 3px outline), gateways 44px; set `width` and `height` to change them.

## Classes and icons

`icons=aws` on `<diagram>` makes AWS win names both vendors share, as in the other diagrams.

Shorthand classes, which your own CSS overrides: `card` (white box, light border), `box`
(white box, dark border), `pill`, `tag`, `banner` (dark band, light text), `muted`, `small`,
`row` and `col` (flex with a gap), `circle` (a round box). `<icon name="app service" size=32>`
places an icon inline, from the same names as the other diagrams.

## Connections

`<script type="application/json">` inside the diagram holds the connections: a list whose
entries are `["from", "to", "label"]` or an object with `from`, `to` and any option of
`connect` (below), `out`, `in` and `via` included: `{ "from": "api", "to": "db", "label":
"writes", "dashed": true, "out": "bottom" }`. Each is routed around the boxes. `via` points
are `"id.anchor"` (`"db.top"`, `"gate.center"`) or `[x, y]`.

A connection is known by its key: its `"id"`, else `from->to`, with `#2` for a second line
between the same boxes. Give an `id` to lines you want to refer to.

## Moving one thing

`nudge="dx,dy"` on any element moves it from where the layout put it, and the lines follow:
a box nudged down 20px is `<div class=card id=db nudge="0,20">`. It is a correction on top
of the layout; to place something properly, change the grid instead.

## Changing a diagram

Edit the file. For moves and connections, the edit command does the same patch in one call
and keeps the rest of the file as written:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/edit.mjs diagram.html --move db 0,20 --connect audit db "archives" --unline 'api->queue'
```

`--line 'a->b' '{"label": "reads", "via": [[420, 160]]}'` changes a connection's options;
`--lines` prints the connections with their keys. Render again afterwards, without
`--recompute`: the render reads the previous SVG, and every line keeps the sides it used
there, whether you set them or the router chose them, so only what changed moves.
`--recompute` routes everything afresh. In the GitHub Copilot app, the graphally canvas
makes the same edits from the mouse.

## The script

It runs after the page is laid out, for what is not a plain connection. Every point comes
from an element.

| Call | Gives |
|---|---|
| `el('id')`, `el('.css selector')` | an element's box |
| `all('.selector')` | every match, in page order |
| box `.x .y .w .h`, `.center`, `.top`, `.right`, `.bottom`, `.left` | numbers; points on the box |
| box `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight`, `.at('top', 0.25)` | corners; a point a fraction along a side |
| point `.x`, `.y`, `.up(d)`, `.down(d)`, `.left(d)`, `.right(d)`, `.move(dx, dy)` | its numbers; the point moved |
| `pt(x, y)`, `mid(a, b)`, `lerp(a, b, t)` | a point; the midpoint; a point a fraction of the way |
| `connect(a, b, { label, via, out, in, … })` | a line **routed** around the boxes |
| `arrow(a, b, { label, … })` | a straight arrow; boxes connect at their facing sides; the label sits beside its middle |
| `curve(a, b, { bend, label, … })` | a curved arrow |
| `draw.moveTo(p).lineTo(p).quadraticCurveTo(c, p).bezierCurveTo(c1, c2, p).closePath()` | any path, as on a canvas |
| `draw.arc(centre, r, fromDeg, toDeg)` | an arc; degrees clockwise from the right |
| `.style({ color, width, dashed, fill, head, tail })` | styles a `draw` path |
| `shape('gateway parallel', p, { size, w, h, fill, stroke, width, dashed })` | a shape centred on a point, from the list above |
| `gate(p, 'G1', { fill, size })` | a red decision diamond with a label, for phase charts |
| `text(p, 'str', { size, weight, italic, color, anchor })` | text centred on a point; `anchor`: `start`, `middle`, `end` |
| `icon(p, 'name', { size })` | an icon centred on a point |

`a`, `b` and `p` take an element, an id, a selector, or a point.

Options of lines (`connect`, `arrow`, `curve`): `color` (a CSS colour or a token name:
`'teal'`, `'rust'`), `width`, `dashed`, `dotted`, `head` and `tail` (`arrow`, `open`,
`circle`, `dot`, `diamond`, `open-diamond`, `none`; `head` defaults to `arrow`, `tail` to
none), `both` (a head at each end), `arrow: false` (no head), and `message: true` for a BPMN
message flow (dashed, an open circle at the source, an open arrowhead). `connect` also
takes `out` and `in` (`top`, `right`, `bottom`, `left`: the sides it leaves and enters) and
`via: [points]` (waypoints it passes through).

## Lines

- `connect` finds its own way. Every box with a background, a border or a shape blocks it,
  and so does text outside boxes (a heading in the way makes it detour: move or align the
  heading clear of the line). A box that holds other boxes in the HTML lets it in to reach
  them, and so does a container it connects to: the line ends on the container's border.
  These do not block: a box painted behind boxes it does not hold (a lane's background in
  the same grid cells), and a full-width header strip without an id, up to 48px tall. The
  script's straight lines count as taken, so `connect` keeps off them.
- Lines that share a side spread along it; a line whose other end faces it runs straight
  in when that end lies along the side. Two boxes line up only when they share a grid row
  or column: put boxes that a straight line joins in one grid (or a `subgrid`), rather
  than nudging one with margins.
- It keeps 6px from boxes, so it passes through any gap wider than 12px. A labelled line
  needs a gap wider than its label (about 7px per character at the default size).
- Where it takes a way you do not want, give it `via` points (from elements: `mid(a.right,
  b.left)`) or `out`/`in` sides; do not fall back to `draw` with offsets.
- `arrow` and `draw` go exactly where you say: use them when the way is obvious (straight
  down a column, along a band).
- The script's drawings paint above the page. A line that must pass behind boxes (a spine
  through a row of cards) belongs in the page: an absolutely positioned `div` placed before
  the cards, which are `position: relative`.

## Problems

| Problem | Fix |
|---|---|
| `script-error` | the message and the script's line say what failed (an unknown id, a value that is not a point) |
| `unknown-shape`, `unknown-icon` | use the suggested name |
| `unroutable` | the line has no way through: widen a gap, or give it `via` points |
| `override-ignored … by=x` | the side is blocked by `x`: choose another side |
| `label-crowded` | widen the gap the line runs through, or shorten the label |
| `short-end` | an arrowhead sits on a bend right before its box: give the line room there (a wider gap, other sides, `via`) |
| `lines-overlap` | two lines share a stretch and read as one: give one `via` points or other sides |
| `page-overflow` | the content is wider than `width`: widen `width`, or narrow the columns |
| `text-overlap` | two texts of the page collide: give one more room |
| `bad-attribute`, `bad-option` | a value that is not allowed (`width=1200`, a `head` name) |

The script's `text`, `gate` and arrow labels are not checked for overlap: look at the PNG.

## Recipes

**Phase and role chart.** A grid with a label column and one column per stage:
`grid-template-columns: 160px repeat(7, 1fr)`. Phase bars span their stages
(`grid-column: span 2`, `shape=chevron`, `border: 0`, a background); a band whose cards
line up with the stages is `grid-column: 2 / -1; display: grid; grid-template-columns:
subgrid`. Gates on a boundary: `gate(pt(mid(a.right, b.left).x, bar.center.y), 'G1')`.
Arrows from each card to the card below: `all('.top .card').forEach((c, i) => arrow(c,
below[i]))`.

**BPMN.** A grid with one row per lane and a label column; lane backgrounds may sit in the
same cells as the tasks. Events with a caption: `<div class=ev><i shape=start
id=s></i>Order placed</div>` with `.ev { display: flex; flex-direction: column;
align-items: center; gap: 4px }`. A boundary event is a child of its task, placed on the
border: `<div shape=task style="position: relative">Review<i shape="event timer"
style="position: absolute; bottom: -18px; right: 14px" id=late></i></div>`; lines can
leave from it. Gateways take a caption the same way, above or below. Sequence flows are `connect`
with labels on the branches; message flows between pools are `connect(a, b, { message:
true })`. A non-interrupting boundary event has `border-style: dashed`.

**Gates that lines connect to.** `gate()` is a drawing, not an element, so lines cannot
end on it. A gate in a flow is an element: `<i shape=gateway id=g1></i>` (or `shape=diamond`
with a background and `border: 0` for a filled one).

**Architecture.** Tiers as boxes holding cards with icons (`<div class=card><icon
name=sql></icon> Orders DB</div>`), placed by a grid; `connect` for the calls, `dashed`
for asynchronous ones. Leave 50px or more between tiers where lines and labels run.

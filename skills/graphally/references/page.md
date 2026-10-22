# Figures in HTML and CSS

`<diagram layout=html>` draws anything that is not a graph for the engine to lay out:
phase and role charts, matrices, step cards, roadmaps, one-page overviews, or several kinds
in one figure. You write the figure as a web page; the browser places every box and wraps
every line; graphally turns the page into SVG. An optional `<script>` then draws by name:
lines from one card to another, gates on a column boundary, arrows, curves.

```html
<diagram layout=html width=1100>
<style>
  .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 40px }
  h1 { margin-bottom: 20px }
  .step { text-align: center }
</style>
<h1>From pilot to production</h1>
<div class="steps">
  <div class="card step" id=plan><icon name=people size=32></icon><h3>Plan</h3><p>Agree the goal</p></div>
  <div class="card step" id=build><icon name=server size=32></icon><h3>Build</h3><p>Ship the pilot</p></div>
  <div class="card step" id=prove><icon name=shield size=32></icon><h3>Prove</h3><p>Test with users</p></div>
  <div class="card step" id=scale><icon name=globe size=32></icon><h3>Scale</h3><p>Roll out</p></div>
</div>
<script>
  const s = all('.step')
  s.slice(1).forEach((step, i) => {
    arrow(s[i].right.right(4), step.left.left(4), { color: 'rust' })
    gate(mid(s[i].right, step.left).up(28), `G${i + 1}`)
  })
</script>
</diagram>
```

## The page

- `width` on `<diagram>` sets the page width (default 1200); the SVG adds a 24px margin on
  each side. The height follows the content.
- Any CSS for layout works: grid (with `grid-column: span 2`, `subgrid`), flexbox,
  `position: absolute` inside a `position: relative` box, margins, padding.
- What is drawn: background colours, borders (solid, dashed, dotted, per side),
  `border-radius`, `clip-path: polygon(…)`, text with its font, size, weight, style,
  colour, `text-transform` and `letter-spacing`, list bullets, and `<icon>`.
- What is not drawn: shadows, gradients, transforms, images, `::before` and `::after`. Draw
  such marks in the script instead.
- Colours: any CSS colour, or the theme tokens `var(--ink)`, `--muted`, `--line`, `--woad`
  (blue), `--rust` (red), `--wash`, `--card`, `--bg`, which follow the dark theme.
- `title` and `subtitle` on `<diagram>` add the standard heading; or write your own `<h1>`.

Shorthand classes (your own CSS overrides them):

| Class | Draws |
|---|---|
| `card` | white box with a light border |
| `box` | white box with a dark border |
| `pill`, `tag` | rounded label, small tag |
| `banner` | dark band with light text |
| `muted`, `small` | grey text, small text |
| `row`, `col` | flex row or column with a gap |
| `chevron` | arrow-shaped box, for phases |
| `diamond`, `circle` | diamond or round box, content centred |

`<icon name="app service" size=32>` places an icon inline, from the same icon names as the
other diagrams.

## The script

It runs after the page is laid out. Nothing in it is a coordinate: every point comes from an
element.

| Call | Gives |
|---|---|
| `el('id')`, `el('.css selector')` | an element's box |
| `all('.selector')` | every match, in page order |
| box `.x .y .w .h`, `.center`, `.top`, `.right`, `.bottom`, `.left` | points on the box |
| box `.topLeft`, `.topRight`, `.bottomLeft`, `.bottomRight`, `.at('top', 0.25)` | corners; a point a fraction along a side |
| point `.up(d)`, `.down(d)`, `.left(d)`, `.right(d)`, `.move(dx, dy)` | a point moved |
| `pt(x, y)`, `mid(a, b)`, `lerp(a, b, t)` | a point; midpoint; a point a fraction of the way |
| `connect(a, b, { label, dashed, both, accent, color, out, in, arrow: false })` | a line **routed** around every box, from the side facing `b` (or `out`/`in`: `top`, `right`, `bottom`, `left`) |
| `arrow(a, b, { label, color, width, dashed, both, arrow: false })` | a straight arrow; boxes connect at their facing sides; the label sits beside its middle |
| `curve(a, b, { bend, label, … })` | a curved arrow, same options |
| `draw.moveTo(p).lineTo(p).quadraticCurveTo(c, p).bezierCurveTo(c1, c2, p).closePath()` | any path, as on a canvas |
| `draw.arc(centre, r, fromDeg, toDeg)` | an arc; degrees clockwise from the right |
| `.style({ color, width, dashed, fill, arrow, both })` | styles a `draw` path |
| `gate(p, 'G1', { fill, size })` | a decision diamond with a label |
| `text(p, 'str', { size, weight, italic, color, anchor })`, `icon(p, 'name', { size })` | text or an icon at a point |
| `shape('circle' \| 'diamond' \| 'rect', p, { size, w, h, fill, stroke, dashed })` | a shape centred on a point |

`a` and `b` take an element, an id, a selector, or a point. `color` takes a CSS colour or a
token name (`'rust'`, `'woad'`). Use `connect` when the line must find its own way; it
keeps clear of the lines the script draws. Use `arrow` and `draw` when you know where the
line goes.

The script's drawings paint above the page. A line that must pass behind boxes (a spine
through a row of cards) belongs in the page: an absolutely positioned `div` placed before
the cards, which are `position: relative`.

## Advice

- Build the structure with the grid: one column per phase or stage, `grid-column: span n`
  for anything that covers several, `grid-template-columns: subgrid` for a band whose cards
  must line up with the columns above. Equal heights in a row come free.
- Give an `id` or a class to everything the script refers to.
- Points between columns: `mid(a.right, b.left)`. Points on a line through a band:
  `pt(mid(a.right, b.left).x, el('spine').center.y)`.
- Loops: `forEach` over `all(…)`, with the index to pair a card with the card below it.

Text that belongs to the layout (labels under arrows, notes in a row) is best written as
page text in a grid cell: the browser wraps it and the overlap check sees it. The render
reports `text-overlap` when two page texts collide (it does not check the script's
`text` and `gate` labels), and `script-error` with the line of the script that failed.

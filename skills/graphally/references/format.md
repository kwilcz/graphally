# The format

A diagram is a web page inside `<diagram>`: the browser places every box and wraps every
line, and graphally turns the page into SVG. The connections are data, a JSON list routed
around the boxes; a drawing script draws what has no box. Nothing in the source is a
coordinate.

Reach for the tools in this order. HTML structure and utility classes (`flex
justify-center gap-6`) place almost everything. Plain CSS in a `<style>` covers what a class
cannot say. The helpers (dates, sequences) do only what CSS cannot: they turn dates into
grid columns and messages into rows. The drawing script draws every mark no box gives:
tracks, rings, leaders, brackets, slabs. Any form a page can hold renders; `design.md`
is about choosing one.

```html
<diagram width=1000>
<div class="grid grid-cols-4 gap-10 items-center justify-items-center">
  <div class="flex flex-col items-center gap-1 text-sm"><i shape=start id=in></i>Order placed</div>
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

## Contents

- [The page](#the-page): width, what is drawn, colours, themes
- [Shapes](#shapes)
- [Classes and icons](#classes-and-icons): utility classes, building blocks
- [Before layout: dates and sequences](#before-layout-dates-and-sequences)
- [Connections](#connections)
- [Moving one thing](#moving-one-thing), [Changing a diagram](#changing-a-diagram)
- [The script](#the-script): every call and option
- [Lines](#lines): how connections find their way
- [Problems](#problems)

## The page

- `width` on `<diagram>` sets the page width (default 1200); the SVG adds a 24px margin on
  each side. The height follows the content, the script's drawings included.
- Any CSS for layout works: grid (with `grid-column: span 2`, `subgrid`), flexbox,
  `position: absolute` inside a `position: relative` box, margins, padding.
- What is drawn: background colours, borders (solid, dashed, dotted, per side),
  `border-radius`, `clip-path: polygon(…)`, shapes, text with its font, size, weight,
  style, colour, `text-transform`, `letter-spacing`, underline and line-through, list
  bullets, and `<icon>`.
- What is not drawn: shadows, gradients, transforms, rotated or vertical text, images,
  `::before` and `::after`. Draw such marks in the script instead.
- Colours: any CSS colour, or the theme tokens, which follow the dark theme: `var(--ink)`
  (text), `--muted`, `--line`, `--card` (white), `--wash`, `--bg`; strong `--woad` (blue),
  `--rust` (red), `--teal`, `--green`, `--purple`, `--amber`; pale `--lane-a` (blue),
  `--lane-b` (green), `--lane-c` (purple), `--lane-d` (orange). Literal colours stay as
  written in both themes.
- `title` and `subtitle` on `<diagram>` add the standard heading; or write your own `<h1>`.
- Every figure paints its own background, the theme's `--bg`: `background="#fff"` on
  `<diagram>` sets a colour, `background="none"` leaves it transparent. `theme=dark` draws
  the dark theme; `render --themes` writes both (`diagram.svg`, `diagram-dark.svg`). Use the
  tokens for colours, so the dark copy follows.
- A file may hold several `<diagram>` elements, among HTML of its own (a report, a wiki
  page). Each keeps its `<style>`, scripts, connections and ids to itself, and the page's
  CSS does not reach it, so two diagrams may both have `id=api` and a `.lane` of their own.

## Shapes

`shape="…"` on any element draws it as that shape. The element is still a box in the
layout, sized by its content and your CSS; its background is the shape's fill and its
border the outline (`border-style: dashed` dashes it). By default a shape has a white fill,
a 1.5px ink outline and centred content. For a filled bar, set `border: 0` and a background.

| Shapes | |
|---|---|
| `rect`, `rounded`, `stadium` (`pill`, `terminator`), `ellipse`, `circle` | basic |
| `diamond` (`decision`), `hexagon`, `triangle`, `parallelogram` (`io`), `trapezoid` | geometric |
| `semicircle` | the top half of an ellipse filling the box: twice as wide as high is a half disc |
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

**Utility classes** have Tailwind's names. Write them on the element, with no `<style>`:
`flex`, `grid grid-cols-3`, `flex-col`, `justify-center`, `justify-between`,
`items-center`, `self-end`, `justify-self-center`, `place-items-center`, `gap-6`,
`gap-x-20`, `p-4`, `px-6`, `mt-10`, `mx-auto`, `w-40`, `w-full`, `max-w-xs`,
`col-span-2`, `col-start-3`, `col-span-full`, `row-span-2`, `grid-cols-subgrid`, `relative`,
`absolute`, `text-center`, `font-semibold`, `uppercase`, `rounded-lg`, `border`,
`border-2`, `border-dashed`. The spacing scale is Tailwind's: one step is 4px, so `gap-6`
is 24px. Brackets take any value: `w-[130px]`, `grid-cols-[160px_repeat(7,1fr)]`,
`gap-[40px_80px]`, `col-[2/-1]`. They also take any property: `[grid-template-areas:'a_b']`.
An underscore stands for a space.
Two differences from Tailwind:
- Colours are the theme tokens: `bg-wash`, `bg-card`, `text-muted`, `text-woad`,
  `border-rust`, `border-line`. They follow the dark theme.
- Text sizes follow the diagram's scale: `text-xs` (11px), `text-sm` (11.5px),
  `text-base` (13px, a label), `text-lg` (15px), `text-xl` (17px), `text-2xl` (22px).

A class that reads like a utility but means nothing is reported as `unknown-utility`. Examples: `bg-blue-500`,
`md:flex`, a typo. A class you style in your own `<style>` is never reported.

**Building blocks** look like the rest of graphally. A utility or a rule of your own overrides
them:
- `figure`: an icon over its name, with a `<small>` line under it, and no frame: the item
  of a topology. Add `external` to mute it, or `accent` to colour it blue.
- `node`: the same in a framed card, the icon beside the name. Add `external` to dash it,
  or `accent` to make it blue.
- `group` with an `<h4>` title (an icon and a `<small>` may go in it). Variants: `dashed`
  or `external`, `vnet`, `subnet`, `region`, `plain`. Put `badges` holding `badge` icons
  in the `<h4>`.
- `tile`: an icon over its name in a small frame.
- `band`: a full-width strip of shared services.
- `key` with `swatch`, `swatch dashed` and `swatch box`: a legend.
- `card`, `box`, `pill`, `tag`, `banner`.
- `disabled` on any of them: a part that is there but does not run (switched off, kept
  for rollback, not yet live). It turns grey, icon included, fades to half and dashes its
  frame, and every line to or from it turns grey and dashed. `"disabled": true` does the
  same to one line. In the legend: `<i class="swatch box disabled"></i>`. Any element with
  CSS `opacity` or `filter: grayscale()` is drawn that way too.

These names are taken (`disabled` too), and so are the sequence helper's: `seq`, `msg`, `num`, `guard`,
`lifeline`, `activation` and `frag-…`. A class of your own with one of them gets their look
too, so name yours differently (`lane`, not `band`; `amount`, not `num`).

`<icon name="app service">` places an icon inline. Loose names work for every service of
both packs (`elasticache`, `glue`, `purview`), for example:

- Azure: `app service`, `functions`, `aks`, `container app`, `acr`, `service bus`,
  `event hubs`, `apim`, `front door`, `app gateway`, `firewall`, `vnet`, `subnet`, `nsg`,
  `private endpoint`, `vpn gateway`, `entra`, `managed identity`, `kv`, `sql`, `cosmos`,
  `redis`, `storage`, `app insights`, `log analytics`, `mg`, `subscription`.
- AWS: `lambda`, `s3`, `dynamodb`, `api gateway`, `cloudfront`, `cognito`, `ec2`, `ecs`,
  `eks`, `fargate`, `rds`, `aurora`, `sqs`, `sns`, `eventbridge`, `step functions`, `vpc`,
  `alb`, `nat gateway`, `route 53`, `cloudwatch`, `iam`, `kms`, `secrets manager`, `waf`.
- Generic: `user`, `users`, `browser`, `mobile`, `laptop`, `server`, `database`, `api`,
  `globe`, `building`, `cloud`, `key`, `lock`, `shield`, `file`, `mail`.

`icons=aws` on `<diagram>` makes AWS win names both clouds share (`load balancer`), or
prefix one icon: `aws:waf`, `azure:firewall`. An unknown name is reported with
suggestions. The first render downloads the Azure and AWS icon packs into the skill (once,
a few seconds).

## Before layout: dates and sequences

`<script type="graphally" before>` runs on the page before the browser lays it out. Use it to make
elements from a list (`make('div', { class: 'card' }, 'text')`, `root`, `el`, `all`), and
to call the two helpers. Each helper does what CSS cannot. What it makes are plain
elements with classes, styled like everything else.

`schedule()` reads `data-start`, `data-end`, `data-duration` (`5d`, `2w`) and `data-after`
(ids, separated by spaces) on elements, and works out every start and end. An end date
is a boundary, so `data-end=2026-04-30` stops at the start of that day.
`timeline('#plan', { lead: '160px' })` makes `#plan` a grid with one column per day and
places every dated element in it, so a bar's left edge is its start date. The grid
runs from the start of the first month to the month after the last date. Pass `from` and
`to` to set the range yourself, or `unit: 'week'` for long plans. It returns `months`,
`quarters` and `years`, each with a `label` and a `column`, for header cells:

For a Gantt chart, give each task a row of its own (a full-width subgrid row: name in the
lead column, bar on its dates) and draw its dependencies with `depend()` in the drawing
script; the names live in the lead column, not beside the bars, so the lines have room.

```html
<div id=plan class="grid gap-y-2">
  <div class="pill bg-lane-a" id=disc data-start=2026-03-02 data-duration=6w>Discovery</div>
  <div class="pill bg-lane-b" data-after=disc data-end=2026-06-30>Build</div>
</div>
<script type="graphally" before>
  schedule();
  const t = timeline('#plan');
  for (const m of t.months) el('#plan').prepend(make('div', { class: 'text-muted text-sm', style: `grid-row: 1; grid-column: ${m.column}` }, m.label));
</script>
```

`sequence('#seq')` lays out a sequence diagram. Participants are direct children marked
`data-who`, in order. Messages are `<p class=msg data-from=a data-to=b>`, with `reply`
(a dashed return) or `async` (an open head). Fragments are `<div class=frag data-kind=alt
data-guard="…">` holding messages, with `<div class=else data-guard="…">` between their
parts. They nest. A group behind some participants is `<div class="group external"
data-who-group="stripe bank"><h4>Third parties</h4></div>`.

Each participant gets a column and each message a row, in source order. The helper adds
lifelines, activation bars (from a call to its reply), numbers and fragment boxes. The
arrows are yours, from the drawing script:

```js
for (const m of all('.msg')) {
  const d = m.el.dataset, a = el(d.from).center.x, b = el(d.to).center.x, y = m.bottom.y - 6;
  const o = { dashed: m.el.matches('.reply'), head: m.el.matches('.async') ? 'open' : 'arrow' };
  if (d.from === d.to) draw.moveTo(pt(a + 6, y - 16)).lineTo(pt(a + 40, y - 16)).lineTo(pt(a + 40, y)).lineTo(pt(a + 6, y)).style(o);
  else arrow(pt(a + (b > a ? 6 : -6), y), pt(b + (b > a ? -6 : 6), y), o);
}
```

## Connections

`<script type="application/json">` inside the diagram holds the connections: a list whose
entries are `["from", "to", "label"]` or an object with `from`, `to` and any option of
`connect` (below), `out`, `in` and `via` included: `{ "from": "api", "to": "db", "label":
"writes", "dashed": true, "out": "bottom" }`. Each is routed around the boxes. `via` points
are `"id.anchor"` (`"db.top"`, `"gate.center"`) or `[x, y]`.

`"to"` or `"from"` may be a list: `{ "from": "lead", "to": ["a", "b", "c"], "out": "bottom",
"in": "top" }` draws one bundle with a shared trunk, which is the bus of an org chart.
With `"in": "left"` on children stacked in a column, the same entry draws a comb.

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

`--connect a b "label" '{"dashed": true}'` adds a connection with options;
`--line 'a->b' '{"label": "reads", "via": [[420, 160]]}'` merges options into one (`null`
removes an option); `--lines` prints the connections with their keys. Render again afterwards, without
`--recompute`: the render reads the previous SVG, and every line keeps the sides it used
there, whether you set them or the router chose them, so only what changed moves.
`--recompute` routes everything afresh.

## The script

`<script type="graphally">` runs after the page is laid out, for what is not a plain
connection. Every point comes from an element. Give it that type: a plain `<script>` would
also run as a page script when the file is opened in a browser (reported as `plain-script`).

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
| `depend(a, b, { color, dashed })` | a dependency on a time chart: from the end of a to the start of b, clear of every other dated element and of other dependencies |
| `draw.moveTo(p).lineTo(p).quadraticCurveTo(c, p).bezierCurveTo(c1, c2, p).closePath()` | any path, as on a canvas |
| `draw.arc(centre, r, fromDeg, toDeg)` | an arc; degrees clockwise from the right |
| `.style({ color, width, dashed, fill, head, tail })` | styles a `draw` path; `fill` takes a token or any CSS colour, `color-mix()` of tokens included |
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
  the same grid cells), a full-width header strip without an id, up to 48px tall, and a
  lane: a box as wide as its parent, with one as wide above or below it and no border all
  round, which a line between lanes crosses straight. A framed box (a subnet) stays a box
  that lines keep out of unless they connect into it. The
  script's straight lines count as taken, so `connect` keeps off them.
- Lines that share a side split it evenly: one meets it at the middle, two at a third and
  two thirds, n at k/(n+1), ordered so they do not cross. A line alone on two facing sides
  runs straight when both ends fit in the middle 80% of their sides. Lines into (or out of)
  one box with the same label and style merge into one trunk with one label. Two boxes line up only when they share a grid row
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
| `warning: box-overflow` | a box, an icon or a line of text sticks out of the drawn box that holds it (a node wider than its group, a word wider than its card): widen the holder or narrow what is inside. A warning: the render passes, and when the overflow is meant, leave it. What is placed with `position: absolute` (a badge on a corner, a timer on a task's edge) is not reported |
| `bad-attribute`, `bad-option` | a value that is not allowed (`width=1200px`, a `head` name, a side that is not `top`, `right`, `bottom` or `left`) |
| `unknown-utility` | a class that reads like a utility and means nothing: use a theme colour (`bg-wash`) or a bracket value (`bg-[#eef]`) |
| `plain-script` | a `<script>` without a type would run in the browser: write `<script type="graphally">` |

The script's `text`, `gate` and arrow labels are not checked for overlap: look at the PNG.
The render's summary counts crossings: lines crossing lines. A crossing is not a problem,
but fewer read better; rearranging the grid or giving a line `out`/`in` or `via` removes one.

Designing a figure: `design.md`. Techniques, each with a complete example: `network.md`,
`hierarchy.md`, `process.md`, `sequence.md`, `plan.md`, `charts.md`, `documents.md`,
`terraform.md`.

---
name: graphally
description: Draws professional diagrams as SVG and PNG from HTML and CSS - architecture with Azure and AWS icons, networks (VNets, subnets, peering, private endpoints), hierarchies and org charts, BPMN processes and flowcharts, sequence diagrams, Gantt plans and roadmaps, phase and role charts, figures for proposals and solution designs (governance, scope, layered solution stacks), and diagrams of Terraform repositories drafted from the code. The browser lays the figure out and graphally routes the connections, so nobody writes a coordinate. Use it whenever the user asks for a diagram, an architecture or network picture, a flow, a process map, a sequence, a timeline, a plan or a roadmap, or wants to visualise infrastructure, even without the word "diagram". Not for charts of numeric data (bar, line, pie).
license: Apache-2.0. Copyright (c) 2026 Kamil Wilczyński (kwilcz), https://github.com/kwilcz/graphally. LICENSE.txt has the terms.
compatibility: Requires Node.js 18 or later and Chrome, Chromium or Edge (or `npx playwright install chromium`). Internet once, to download the Azure and AWS icon packs.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/edit.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/tf2graphally.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/fetch-icons.mjs *)
metadata:
  author: Kamil Wilczyński (kwilcz)
  repository: https://github.com/kwilcz/graphally
  version: "2.4.0"
---

# graphally

A diagram is a small web page: HTML says what exists and what contains what, CSS says
where it goes, and a JSON list says what connects to what. graphally lays the page out in
a browser, routes the connections around the boxes, and writes an SVG. Never write
coordinates, and never hand-write SVG.

Reach for the tools in this order:

1. **HTML and utility classes** place almost everything: `grid grid-cols-4 gap-x-20`,
   `flex justify-between`, `col-span-2`.
2. **CSS in a `<style>`** covers what a class cannot say (`grid-template-areas`).
3. **The helpers** do only what CSS cannot: dates to grid columns, messages to rows.
4. **The drawing script** draws only what has no box: a gate on a boundary, a lifeline arrow.

## Workflow

Copy this checklist and work through it; render as often as the diagram needs.

```
- [ ] 1. Read the reference for the diagram's kind (table below), unless it is a plain architecture diagram
- [ ] 2. Write diagram.html
- [ ] 3. Render: node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs render diagram.html --png
- [ ] 4. Fix every reported problem; render again until it prints ok
- [ ] 5. Look at diagram.png; fix what reads badly; render again
- [ ] 6. Hand over diagram.svg, diagram.png and diagram.html
```

1. **The reference.** Each kind has a page with a complete example to start from.
2. **Write.** Start from the example below or the reference's. Ids name what the
   connections join; text is what the reader sees.
3. **Render.** The command writes `diagram.svg` (the deliverable) and `diagram.png` (a
   preview), then prints `ok` or one line per problem. `${CLAUDE_SKILL_DIR}` is this
   skill's directory: Claude Code fills it in; elsewhere, use the path of the folder that
   holds this file.
4. **Fix.** Each problem names its cause and a fix (table below). Edit the file and render
   again.
5. **Look.** `ok` means nothing collides, not that the story reads well: check that the
   flow runs one way, labels sit by their lines, and nothing important is crowded.
6. **Hand over.** The render adds a header to the `.html` (a doctype and a `<script>`
   that loads graphally's viewer), so the file itself shows the diagram when opened in a
   browser, with nothing installed. Keep the header; anyone can edit the text and reload.

**Changing an existing diagram:** edit its `.html` in place, then render. The render reads
the previous SVG, so what you did not change stays where it was. Keep `nudge`, `out` and
`in`: they are the user's corrections. `--recompute` lays everything out afresh.

## Example

```html
<diagram width=1300 title="Orders platform" subtitle="Production, West Europe">
<div class="grid grid-cols-4 items-start justify-between gap-x-20">
  <div class="group plain"><h4>Users</h4>
    <div class="node external" id=shopper><icon name=browser></icon>Shopper<small>web browser</small></div>
  </div>
  <div class=group><h4><icon name="front door"></icon>Edge</h4>
    <div class=node id=fd><icon name="front door"></icon>Front Door<small>WAF</small></div>
  </div>
  <div class=group><h4>Application</h4>
    <div class=node id=api><icon name="app service"></icon>Orders API<small>App Service</small></div>
    <div class=node id=worker><icon name=functions></icon>Worker<small>Functions</small></div>
  </div>
  <div class=group><h4>Data</h4>
    <div class=node id=db><icon name=sql></icon>Orders DB<small>Azure SQL</small></div>
    <div class="node accent" id=sb><icon name="service bus"></icon>Service Bus<small>orders topic</small></div>
  </div>
</div>
<script type="application/json">
[
  ["shopper", "fd", "HTTPS"],
  ["fd", "api"],
  ["api", "db", "writes"],
  { "from": "api", "to": "sb", "label": "order placed", "dashed": true },
  { "from": "sb", "to": "worker", "label": "events", "dashed": true }
]
</script>
</diagram>
```

## The format in brief

- **`<diagram>`**: `width` in pixels (default 1200; the height follows the content),
  `title`, `subtitle`, `icons=aws` (AWS wins names both clouds share), `theme=dark`,
  `background` (a colour, or `none`).
- **Utility classes** have Tailwind's names and spacing (one step is 4px): `grid`,
  `grid-cols-3`, `flex`, `flex-col`, `justify-between`, `items-center`, `gap-6`, `p-4`,
  `mt-10`, `col-span-2`, `w-40`, `text-center`, `font-semibold`, `rounded-lg`, `border-dashed`.
  Brackets take any value or property: `w-[130px]`, `grid-cols-[160px_1fr]`,
  `[grid-area:edge]`. Colours are the theme's tokens (`bg-wash`, `text-muted`,
  `border-woad`); text sizes follow the diagram's scale (`text-base` is 13px).
- **Building blocks**: `node` (a card: `<icon>`, a name, a `<small>` line; `external`,
  `accent`), `group` with an `<h4>` title (`plain`, `dashed`, `external`, `vnet`, `subnet`,
  `region`; `badges` of `badge` icons in the title), `tile` and `figure` (an icon over its
  name), `band` (a strip of shared services), `key` with `swatch` (a legend), `card`,
  `box`, `pill`, `tag`, `banner`. These class names are taken: name your own differently.
- **Shapes**: `shape="cylinder"` on any element draws it as that shape: `diamond`,
  `hexagon`, `chevron`, `semicircle`, `document`, `cloud`, BPMN `task`, `start`, `end`,
  `gateway exclusive`, `event timer` and more. `clip-path: polygon(…)` cuts any other
  straight-edged shape.
- **Icons**: `<icon name="app service">`. Loose names work for every service of both
  packs; an unknown name is reported with suggestions.
- **Connections**: `<script type="application/json">`, a list of `["from", "to", "label"]`
  or objects with `dashed`, `out`/`in` (the sides), `both`, `via`, `color`. A list in `to`
  or `from` draws one bundle with a shared trunk.
- **Drawing script**: `<script type="graphally">` runs after layout with every element's
  box: `arrow`, `connect`, `depend`, `draw.moveTo(…).lineTo(…)`, `gate`, `text`, `shape`.
- **Helpers**: `<script type="graphally" before>` calls `schedule()` and `timeline()`
  (plans) or `sequence()` (sequence diagrams) before layout.
- **Themes**: `--themes` writes `diagram-dark.svg` beside the light one; `--dark` draws
  dark only.

The whole format, with every class, shape, option and call: [references/format.md](references/format.md).

## Problems and fixes

| Problem | Fix |
|---|---|
| `unknown-id` | a connection names an id that does not exist: the suggestion is the closest |
| `unknown-icon`, `unknown-shape`, `unknown-utility` | use the suggested name, or a theme colour for a colour class |
| `label-crowded` | widen the gap the line runs through, or shorten the label |
| `override-ignored … by=x` | the side named in `out`/`in` is blocked by `x`: choose another side |
| `short-end` | an arrowhead sits on a bend right before its box: give the line more room there |
| `lines-overlap` | two lines share a stretch: give one other sides (`out`/`in`) or `via` points |
| `unroutable` | the line has no way through: widen a gap, or give it `via` points |
| `page-overflow` | the content is wider than `width`: widen `width`, or narrow the columns |
| `text-overlap` | two texts collide: give one more room |
| `script-error` | the message and line say what failed in a script |

## References

Read the one for the kind of diagram you draw; each starts with a complete example.

| Kind | Reference |
|---|---|
| Networks: VNets, subnets, peering, hub and spoke, private endpoints | [references/network.md](references/network.md) |
| Hierarchies: management groups, org charts, module trees | [references/hierarchy.md](references/hierarchy.md) |
| BPMN processes with swimlanes, and flowcharts | [references/process.md](references/process.md) |
| Sequence diagrams: calls, replies, loops, alternatives | [references/sequence.md](references/sequence.md) |
| Plans: Gantt charts, roadmaps, milestones, dependencies | [references/plan.md](references/plan.md) |
| Phase and role charts, matrices, step cards, anything else | [references/charts.md](references/charts.md) |
| Figures for proposals and solution designs: governance pyramids, scope targets, layered solution stacks; custom shapes, radial layouts, drawing on the layout | [references/documents.md](references/documents.md) |
| A diagram of a Terraform repository, drafted from the code | [references/terraform.md](references/terraform.md) |
| The whole format | [references/format.md](references/format.md) |

## Scripts

- `scripts/graphally.mjs render <file.html>... [--png | --png2x] [--themes | --dark] [--out dir] [--recompute]`:
  compiles every `<diagram>` in the file to SVG; `--png` adds a preview, `--png2x` a sharp
  PNG to publish, `--themes` a dark copy, `--recompute` ignores the previous layout. Several
  files render in one call, in parallel; render them together rather than one by one.
- `scripts/edit.mjs <file.html> --move id dx,dy | --connect from to [label] | --line 'a->b' json | --unline 'a->b' | --lines`:
  patches moves and connections and keeps the rest of the file as written.
- `scripts/tf2graphally.mjs <terraform dir> [--out file.html] [--title "…"]`: drafts a
  diagram of a Terraform configuration.
- `scripts/fetch-icons.mjs [azure] [aws] [--force]`: downloads the icon packs; the first
  render does it by itself.

They need only Node.js and an installed Chrome, Chromium or Edge. If the render prints
`graphally needs Chrome, Chromium or Edge`, run `npx playwright install chromium` once, or
set `CHROMIUM_PATH` to a browser executable. Offline, diagrams render without vendor icons
and say how to fetch them later.

---
graphally · Copyright (c) 2026 Kamil Wilczyński (kwilcz) · https://github.com/kwilcz/graphally ·
Apache License 2.0 (LICENSE.txt, NOTICE.txt).

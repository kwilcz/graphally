# How graphally works

graphally turns a diagram written as a small web page into a finished SVG. The author,
usually a coding agent, says what exists and what contains what in HTML, where it goes in
CSS, and what connects to what in a JSON list. The browser decides every coordinate.

## The source

```html
<diagram width=1000 title="Orders platform">
<div class="grid grid-cols-3 items-start justify-between gap-x-20">
  <div class=group><h4>Edge</h4>
    <div class=node id=fd><icon name="front door"></icon>Front Door<small>WAF</small></div></div>
  <div class=group><h4>Application</h4>
    <div class=node id=api><icon name="app service"></icon>Orders API<small>App Service</small></div></div>
  <div class=group><h4>Data</h4>
    <div class=node id=db><icon name=sql></icon>Orders DB<small>Azure SQL</small></div></div>
</div>
<script type="application/json">
[ ["fd", "api", "HTTPS"], ["api", "db", "writes"] ]
</script>
</diagram>
```

There are no coordinates or sizes in it. Adding a box is one line, and the page makes room
for it; adding a connection is one entry in the list.

The author reaches for the tools in this order: HTML and utility classes with Tailwind's
names place almost everything; CSS in a `<style>` covers what a class cannot say; two
helpers do only what CSS cannot (dates to grid columns, messages to rows); a drawing
script draws only what has no box.

## The pipeline

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/pipeline-dark.svg"><img alt="The render pipeline as a flowchart, with the agent's fix loop" src="diagrams/pipeline.svg"></picture>

All of it runs in a headless Chrome, Chromium or Edge, driven by the skill's scripts over
the DevTools protocol, so text is measured with the same font that draws it.

1. **Before script** (`<script type="graphally" before>`): makes or places elements before
   layout, with the helpers `schedule()`, `timeline()` (`time.js`) and `sequence()`
   (`seq.js`).
2. **Utility classes** (`utilities.js`): the classes the page uses become CSS; a class that
   reads like a utility and means nothing is reported.
3. **Lay out**: the browser lays the page out, with graphally's building blocks and shapes
   as zero-specificity defaults, so any rule of the author wins.
4. **Read geometry** (`page.js`): every element's box, every line of text with its own
   measured position and baseline.
5. **Route** (`route.js`): the JSON connections, orthogonally, around the boxes.
6. **Drawing script** (`<script type="graphally">`): runs with the geometry of every element
   and draws by name: arrows, gates, dependency lines (`depend()`), text, shapes.
7. **Render** (`page.js`, `shapes.js`): SVG with colours as CSS tokens, icons as reusable
   symbols, shapes drawn from path templates over the boxes the browser gave them.
8. **Check**: unknown ids, icons, shapes and classes, crowded labels, short arrow ends,
   overlapping lines and text, content wider than the page. Each problem is one line that
   names its fix.

One render, step by step: the script serves the skill and the diagram folder on
127.0.0.1, starts the browser, lets the engine compile the page, and reads back the SVG
and a screenshot.

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/render-sequence-dark.svg"><img alt="A render as a sequence diagram" src="diagrams/render-sequence.svg"></picture>

Most of a render's time is starting the browser and compiling the diagram:

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/render-timeline-dark.svg"><img alt="A render's stages on a time axis" src="diagrams/render-timeline.svg"></picture>

The same engine also runs without the script. `tools/build-viewer.mjs` bundles it with the
theme and an index of the icon packs (names and upstream files, no artwork) into
`skills/graphally/viewer/graphally.js`, about 190 KB. A diagram file that loads it, from
jsDelivr or a local copy, renders itself where it stands when a browser opens it, from disk
too, since it is a classic script rather than a module. The viewer compiles each diagram
twice when it draws icons: the first pass names them, the viewer fetches just those files
from the draw.io repository and the aws-icons package, and the second pass draws them. It
loads Inter from the inter-ui package, so the text measures as it does in a render, and it
follows the reader's light or dark setting.

## One page, many diagrams

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/layouts-dark.svg"><img alt="HTML and CSS place most diagrams; two helpers place plans and sequences" src="diagrams/layouts.svg"></picture>

Every kind of diagram is a page, so no kind needs a layout algorithm of its own:

- **Architecture and networks**: a grid map of areas (`grid-template-areas`) holding groups
  of nodes; VNets and subnets are nested groups.
- **Hierarchies**: one column per leaf and one row per level; a parent spans the columns of
  its children, and a connection to a list of children draws one bus.
- **Processes**: one column per step in the order of the flow, one subgrid row per lane.
- **Plans**: `schedule()` resolves `data-after` and durations into dates; `timeline()` makes
  a grid with one column per day, so a bar's left edge is its start date. `depend()` draws
  each dependency from the end of one task to the start of the next, clear of every bar.
- **Sequences**: `sequence()` gives each participant a column and each message a row,
  which CSS auto-placement cannot, and adds lifelines, activation bars, numbers and
  fragment boxes as plain elements styled by CSS.
- **Anything else**: phase and role charts, matrices, step cards; bands of cards line up
  with a chart's columns through `subgrid`.

`shape="…"` on an element draws it from a library of path templates (`shapes.js`:
flowchart, BPMN, stores, block arrows) over the box the browser gave it, with its background
and border as fill and outline.

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/shapes-dark.svg"><img alt="Every shape and marker" src="diagrams/shapes.svg"></picture>

## Routing and labels

Connections are found by A* search over a sparse grid built from the boxes' edges and the
channels between them. A path's cost counts:

- its length;
- its bends;
- crossings, priced above bends;
- running along another line or along a group's border;
- passing through groups the line does not belong to.

Routing runs in two passes. The first picks the side each line leaves from. The second
fixes where lines meet their boxes: lines that share a side split it evenly, one at the
middle, two at a third and two thirds, n at k/(n+1), ordered so they do not cross; a line
alone on two facing sides runs straight when both ends fit in the middle 80% of their
sides. A few rounds of rip-up and reroute follow, and then parallel segments are pulled
apart.

Lines that share an end and say the same thing bundle: a connection with a list of sources
or targets, or lines with the same label in the same style. A bundle meets its shared box
at one point and routes as a tree: its longest line first, then each other line joins the
lines already drawn. The bundle draws one trunk and carries one label, and every arrowhead
in it sits at least 36px past the trunk's last bend.

Labels are placed longest first, at candidate positions along their line. A candidate must
avoid boxes, text, group borders, other labels and other lines.

## Stable layout and overrides

The source is the diagram; the SVG is compiled output, and its elements record where they
landed. Every element with an id is wrapped in `<g data-id data-box="x,y,w,h">`, and every
connection in `<g data-edge data-sides="out,in">`; corrections add `data-nudge`, `data-out`
and `data-in`. Tools can find any element by its id.

When a diagram is rendered again, the CLI reads that layout back from the previous SVG, and
every line that existed before keeps the sides it used, whether the author set them or the
router chose them; only what changed moves. `--recompute` ignores the previous SVG.

Corrections live in the source: `nudge="dx,dy"` on an element moves it after layout, and
`out` and `in` on a connection fix the sides it leaves and enters. Because they live in the
source, an edit keeps them, and a render that finds one missing compared with the previous
SVG reports it. `scripts/edit.mjs` patches moves and connections by key (a connection's
`id`, else `from->to`, with `#2` for a repeat) and keeps the rest of the file as written.

## Terraform

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/terraform-dark.svg"><img alt="tf2graphally and the agent, as swimlanes" src="diagrams/terraform.svg"></picture>

`scripts/tf2graphally.mjs` reads a Terraform root module and its local modules without
running Terraform. It follows references through variables, locals and module outputs,
and expands `for_each` over literal maps. It then writes a diagram file of what the
configuration deploys:

- resource groups as `group` boxes;
- VNets holding subnets, and resources inside the subnet they are deployed into;
- App Service plans holding their apps;
- references as connections named by meaning: secrets, telemetry, private link, peering,
  routes.

Associations, role assignments, diagnostic settings and child resources fold into those
connections and labels.

## Icons

Azure and AWS icons are not part of the skill. `scripts/fetch-icons.mjs` downloads them
the first time a diagram is rendered, from their upstream sources:

- **Azure:** Microsoft's official icons as published in the draw.io repository, at the
  commit pinned in `assets/icon-sources/azure.txt`.
- **AWS:** the AWS Architecture Icons from the `aws-icons` package on the npm registry.

Each pack becomes one JSON file in `assets/icons/`, or in `~/.cache/graphally/icons` when
the skill folder is read-only. Downloads use `curl` when it is available, so proxy
settings apply, and Node's `fetch` otherwise. Without a network, diagrams still render,
without vendor icons, and the output says how to fetch them.

Icon names are matched loosely, in both packs: `lambda`, `s3`, `app service` and `kv` all
work. `icons=aws` on `<diagram>` makes AWS win names both vendors share, and `aws:` or
`azure:` picks a pack for one icon. A small set of generic outline icons (people,
devices, servers, documents) covers what has no vendor icon.

<picture><source media="(prefers-color-scheme: dark)" srcset="diagrams/install-dark.svg"><img alt="How the skill reaches an agent, and where its icons come from" src="diagrams/install.svg"></picture>

## Theming and output

Colours are CSS custom properties in `assets/theme.css`, with a light and a dark set; a
brand theme redefines the tokens and nothing else. Every figure paints its own background
(the theme's `--bg`, or `background` on `<diagram>`), so it reads on a dark page as on a
light one. `render --themes` writes the dark copy beside the light one, and a page can show
the one that matches its reader with a `<picture>` element. A standalone SVG embeds its
styles; an inlined one uses the page's tokens. Text stays text, and the SVG's `aria-label`
describes the diagram in words.

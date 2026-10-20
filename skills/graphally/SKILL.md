---
name: graphally
description: Draws professional diagrams as SVG from a short HTML description - architecture (Azure and AWS icons, tiers, shared services), networks (VNets, subnets, peering, private endpoints), hierarchies (management groups, org charts), BPMN processes and flowcharts, sequence diagrams, Gantt plans, and diagrams of Terraform repositories generated from the code. Use it whenever the user asks for a diagram, architecture picture, flow, process map, sequence, timeline or plan, or wants to visualise infrastructure, even if they do not say "diagram"; never hand-write SVG coordinates instead.
license: Proprietary. Copyright (c) 2026 Kamil Wilczyński (kwilcz), https://github.com/kwilcz/graphally. Use only; LICENSE.txt has complete terms.
compatibility: Requires Node.js 18 or later and Chrome, Chromium or Edge (or `npx playwright install chromium`). Internet once, to download the Azure and AWS icon packs.
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/tf2graphally.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/fetch-icons.mjs *)
metadata:
  author: Kamil Wilczyński (kwilcz)
  repository: https://github.com/kwilcz/graphally
  version: "1.0.0"
---

# graphally

You describe what exists, what contains what, and what talks to what. graphally sizes,
aligns and routes everything and writes the SVG. Never write coordinates.

## Workflow (aim for 3 or 4 tool calls)

1. If the diagram is not a plain architecture diagram, read its reference (listed at the
   end) together with anything else you need, in one command: every extra step re-reads
   everything before it.
2. Write the whole diagram and render it in **one shell command**, in your working
   directory:
   ```sh
   cd <working dir> && cat > diagram.html <<'EOF'
   <diagram …> … </diagram>
   EOF
   node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs render diagram.html --png
   ```
   It prints `ok` or one line per problem, and writes `diagram.svg` (the deliverable) and
   `diagram.png` (a preview). `${CLAUDE_SKILL_DIR}` is the directory of this skill: Claude
   Code fills it in; elsewhere, use the path of the folder that holds this file.
3. Fix the reported problems the same way (rewrite and render in one command).
4. Look at the PNG once at the end: `ok` means nothing collides, not that the story reads
   well.

## Syntax

```html
<diagram title="Orders platform" subtitle="Production, West Europe">
<layout>
users  edge  app   data
key    .     bus   bus
</layout>
<group id=users label="Users" style=plain>
  <node id=shopper icon=browser external>Shopper | web browser</node>
</group>
<group id=edge label="Edge" icon="front door">
  <node id=fd icon="front door">Front Door | WAF</node>
</group>
<group id=app label="Application">
  <node id=api icon="app service">Orders API | App Service</node>
  <node id=worker icon=functions>Worker | Functions</node>
</group>
<group id=data label="Data"><node id=db icon=sql>Orders DB | Azure SQL</node></group>
<group id=bus label="Messaging"><node id=sb icon="service bus">Service Bus | orders topic</node></group>
<links>
shopper -> fd : HTTPS
fd -> api
api -> db : writes
api ~> sb : order placed
sb ~> worker : events
</links>
</diagram>
```

- **`<node>`**: `Name | second line`. Attributes: `id`, `icon`, `external` (outside your
  control, dashed), `accent` (the one thing to highlight), `style=card` (default) `tile`
  `icon` `chip`.
- **`<group>`**: `id`, `label`, `icon`, `sub` (e.g. a CIDR range), `style=box` (default)
  `plain` `dashed` `external` `vnet` `subnet` `component` `region`. Groups nest. Children
  stack vertically; `layout=row` or `layout=grid cols=3`, or a nested `<layout>` map.
  `<band>` is a full-width row of items (shared platform services); if it is not in the
  map it becomes the bottom row. `sub` is free text shown after the label.
- **`<layout>`**: an ASCII map of the diagram (or of a group), one word per cell, like CSS
  `grid-template-areas`. Each word is the id of a direct child; repeat a word to span
  cells; `.` is empty; `key` places the legend. Without a map, groups are placed in
  columns following the flow of the links.
- **`<links>`**: one per line, `from -> to : label`. Several ids allowed on each side
  (`a, b -> c`); chains allowed (`a -> b -> c`). `->` call, `~>` async message or event
  (dashed), `<->` two-way, `--` plain line, `=>` highlighted. A group id is a valid end:
  `app -> kv : secrets` instead of one edge per app.
- **Large diagrams**: split them into files with `<include src="parts/app.html">`. A part
  holds one `<group id=app>`; inside it, ids and links are local, and from the main file
  its items are `app.<id>` (`fd -> app.api`).
- **Shared services**: a link between a whole **group** and an item of a `<band>`
  (`web, api -> kv`) is drawn as a badge, the item's icon in the group's header, not a
  line. Link a **node** to the band item when the line itself matters (private endpoint
  to its database).
- **Icons**: loose names work.
  - Azure: `app service`, `functions`, `aks`, `container app`, `acr`, `service bus`,
    `event hubs`, `apim`, `front door`, `app gateway`, `firewall`, `vnet`, `subnet`, `nsg`,
    `private endpoint`, `vpn gateway`, `entra`, `managed identity`, `kv`, `sql`, `cosmos`,
    `redis`, `storage`, `app insights`, `log analytics`, `mg`, `subscription`.
  - AWS: `lambda`, `s3`, `dynamodb`, `api gateway`, `cloudfront`, `cognito`, `ec2`, `ecs`,
    `eks`, `fargate`, `rds`, `aurora`, `sqs`, `sns`, `eventbridge`, `step functions`, `vpc`,
    `alb`, `nat gateway`, `route 53`, `cloudwatch`, `iam`, `kms`, `secrets manager`, `waf`.
    Put `icons=aws` on `<diagram>` so AWS wins names both clouds share (`load balancer`), or
    prefix one icon: `aws:waf`, `azure:firewall`.
  - Generic: `user`, `users`, `browser`, `mobile`, `laptop`, `server`, `database`, `api`,
    `globe`, `building`, `cloud`, `key`, `lock`, `shield`, `file`, `mail`.

  An unknown name is reported with suggestions. The first render downloads the Azure and
  AWS icon packs into this skill (once, a few seconds); offline, diagrams render without
  vendor icons and say how to fetch them.

## Layout advice

- One map row is one band of the story: request path on top, data below, shared platform
  in a bottom `<band>`. Put the entry point on the left, external systems on the right.
- Nodes in a group stack in source order; the engine lines them up with what they connect
  to, so order them in the order of the flow.
- Put what a service calls beside it (the next column), not under it: a stack below forces
  every edge to go round the nodes in between.
- Label edges with what flows, in one to three words. Draw shared services once, with one
  edge from a group, or none.

## Problems and fixes

| Problem | Fix |
|---|---|
| `unknown-id` | typo; the suggestion is the closest id |
| `unknown-icon` | use a suggested name |
| `not-in-layout` | add the id to the `<layout>` map, or remove the map |
| `label-crowded` | shorten the label (gaps already widen to fit labels) |
| `too-wide`, `too-tall` | move groups into another row or column of the map |
| `text-overlap` | shorten the text involved |

## More diagram types

Read only the one you need:

- [references/network.md](references/network.md): VNets, subnets, peering, hub and spoke.
- [references/tree.md](references/tree.md): management groups, org charts, module trees.
- [references/process.md](references/process.md): BPMN swimlanes and flowcharts.
- [references/sequence.md](references/sequence.md): sequence diagrams (calls, replies, loops, alternatives).
- [references/gantt.md](references/gantt.md): plans and timelines (Gantt charts, milestones, dependencies).
- [references/terraform.md](references/terraform.md): a diagram of a Terraform repository, generated from the code.

## Scripts

- `scripts/graphally.mjs render <file.html> [--png | --png2x] [--dark] [--out dir]`: compiles
  every `<diagram>` in the file to SVG; `--png` adds a preview, `--png2x` a sharp PNG.
- `scripts/tf2graphally.mjs <terraform dir> [--out file.html] [--title "…"]`: drafts a
  diagram of a Terraform configuration (see `references/terraform.md`).
- `scripts/fetch-icons.mjs [azure] [aws] [--force]`: downloads the icon packs; the first
  render does this by itself.

They need only Node.js and an installed Chrome, Chromium or Edge. If the render prints
`graphally needs Chrome, Chromium or Edge`, run `npx playwright install chromium` once, or
set `CHROMIUM_PATH` to a browser executable.

---
graphally · Copyright (c) 2026 Kamil Wilczyński (kwilcz) · https://github.com/kwilcz/graphally ·
use only, under LICENSE.txt. Do not copy, modify, redistribute or incorporate this skill.

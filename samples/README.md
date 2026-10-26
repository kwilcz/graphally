# Showcase

Every figure here was drawn by an agent from a brief. Each folder holds the brief, the
source the agent wrote (`diagram.html`, which also opens in a browser), and the result in
both themes: `diagram.svg` and `diagram-dark.svg`, with PNGs. The pictures on this page
follow your theme.

**Basic** samples are the everyday technical diagrams. Each one follows a recipe from the
skill's references: building blocks in a grid, and a JSON list of connections.

**Advanced** samples go past boxes and lines. They turn dates into grid columns, cut
shapes in CSS, place items by angle, or draw geometry around the layout. Most were made
for proposals, statements of work and solution designs.

| Basic | | Advanced | |
|---|---|---|---|
| [Architecture](#architecture) | Azure field-service platform | [Plan (Gantt)](#plan-gantt) | six-month migration plan |
| [AWS](#aws) | serverless photo sharing | [Phase and role chart](#phase-and-role-chart) | who does what in a move to AKS |
| [Network](#network) | hub, spokes, private endpoints | [Governance pyramid](#governance-pyramid) | who meets whom, and how often |
| [Terraform repository](#terraform-repository) | drafted from the code | [Scope target](#scope-target) | in scope, options, out of scope |
| [Process (BPMN)](#process-bpmn) | expense approval in four lanes | [Solution stack](#solution-stack) | the platform as layers |
| [Flowchart](#flowchart) | release pipeline with rollback | | |
| [Sequence](#sequence) | checkout with 3-D Secure | | |
| [Hierarchy](#hierarchy) | management groups | | |
| [Icon diagram](#icon-diagram) | Entra application proxy | | |

## Basic

### Architecture

<picture><source media="(prefers-color-scheme: dark)" srcset="architecture/diagram-dark.png"><img alt="Azure field-service platform" src="architecture/diagram.png"></picture>

Tiers as columns, a platform band, async traffic dashed, external systems dashed. Shared
services (Key Vault, App Insights, the registry) appear as badges in the headers of the
tiers that use them, instead of wires.
[Brief](architecture/brief.md) · [source](architecture/diagram.html) · [SVG](architecture/diagram.svg)

### AWS

<picture><source media="(prefers-color-scheme: dark)" srcset="aws/diagram-dark.png"><img alt="Serverless photo sharing on AWS" src="aws/diagram.png"></picture>

The same kind of diagram with the AWS pack: CloudFront and WAF at the edge, Lambda
functions behind API Gateway, and the asynchronous path from S3 through SQS and SNS
drawn dashed. CloudWatch and Secrets Manager are badges on the two function groups.
[Brief](aws/brief.md) · [source](aws/diagram.html) · [SVG](aws/diagram.svg)

### Network

<picture><source media="(prefers-color-scheme: dark)" srcset="network/diagram-dark.png"><img alt="Hub-and-spoke network" src="network/diagram.png"></picture>

VNets, subnets with their address ranges, resources inside their subnets, peering, a
default route to the firewall, private endpoints to the PaaS services below.
[Brief](network/brief.md) · [source](network/diagram.html) · [SVG](network/diagram.svg)

### Terraform repository

<picture><source media="(prefers-color-scheme: dark)" srcset="terraform/diagram-dark.png"><img alt="Diagram of a Terraform repository" src="terraform/diagram.png"></picture>

`tf2graphally` read the configuration in [`repo/`](terraform/repo) and wrote
[`draft.html`](terraform/draft.html) ([rendered](terraform/draft.svg)), without the agent
reading the HCL. The agent then added what Terraform cannot know, the users and the VPN
from head office, and rearranged the services.
[Brief](terraform/brief.md) · [source](terraform/diagram.html) · [SVG](terraform/diagram.svg)

### Process (BPMN)

<picture><source media="(prefers-color-scheme: dark)" srcset="process/diagram-dark.png"><img alt="BPMN swimlanes" src="process/diagram.png"></picture>

Four lanes, one column per step in the order the flow runs, gateways with labelled
branches, a three-day timer on the review task, notices between lanes dashed.
[Brief](process/brief.md) · [source](process/diagram.html) · [SVG](process/diagram.svg)

### Flowchart

<picture><source media="(prefers-color-scheme: dark)" srcset="flowchart/diagram-dark.png"><img alt="Release pipeline flowchart" src="flowchart/diagram.png"></picture>

The happy path runs along the middle; every failure branches up, and the expired
approval drops below.
[Brief](flowchart/brief.md) · [source](flowchart/diagram.html) · [SVG](flowchart/diagram.svg)

### Sequence

<picture><source media="(prefers-color-scheme: dark)" srcset="sequence/diagram-dark.png"><img alt="Checkout sequence" src="sequence/diagram.png"></picture>

Numbered steps, activation bars, an `alt` for 3-D Secure, a `par` with a polling `loop`.
[Brief](sequence/brief.md) · [source](sequence/diagram.html) · [SVG](sequence/diagram.svg)

### Hierarchy

<picture><source media="(prefers-color-scheme: dark)" srcset="hierarchy/diagram-dark.png"><img alt="Management group hierarchy" src="hierarchy/diagram.png"></picture>

One column per leaf and one row per level: each parent spans its children, and one
connection per parent draws its bus.
[Brief](hierarchy/brief.md) · [source](hierarchy/diagram.html) · [SVG](hierarchy/diagram.svg)

### Icon diagram

<picture><source media="(prefers-color-scheme: dark)" srcset="icons/diagram-dark.png"><img alt="Entra application proxy" src="icons/diagram.png"></picture>

Figures: an icon over its name, in plain groups.
[Brief](icons/brief.md) · [source](icons/diagram.html) · [SVG](icons/diagram.svg)

## Advanced

### Plan (Gantt)

<picture><source media="(prefers-color-scheme: dark)" srcset="plan/diagram-dark.png"><img alt="Migration plan" src="plan/diagram.png"></picture>

A task table beside the chart, a critical path, a blocked approval holding back the
pilot, parallel work, and only the dependencies that tell the story.
**Technique:** `schedule()` and `timeline()` turn dates into grid columns, so each bar's
left edge is its start date; `depend()` draws each dependency clear of the bars
([`plan.md`](../skills/graphally/references/plan.md)).
[Brief](plan/brief.md) · [source](plan/diagram.html) · [SVG](plan/diagram.svg)

### Phase and role chart

<picture><source media="(prefers-color-scheme: dark)" srcset="phases/diagram-dark.png"><img alt="Who does what in the move to AKS" src="phases/diagram.png"></picture>

Four phases as chevrons, three teams as bands of cards, milestones on the boundaries
between phases, hand-offs between the teams, and a repeat badge on the wave that loops.
**Technique:** the bands line up with the phases through `subgrid`; the script finds each
boundary between two elements and puts a milestone on it
([`charts.md`](../skills/graphally/references/charts.md)).
[Brief](phases/brief.md) · [source](phases/diagram.html) · [SVG](phases/diagram.svg)

### Governance pyramid

<picture><source media="(prefers-color-scheme: dark)" srcset="governance/diagram-dark.png"><img alt="How the client and the partner work together" src="governance/diagram.png"></picture>

The client's levels on the left, the partner's on the right, and on the spine between
them the forum where each level meets its counterpart, with how often it meets.
Escalations climb one slope; decisions come down the other.
**Technique:** each tier is a box in a grid cell, cut by `clip-path: polygon()` so its
slope continues the tier above; only the arrows come from the script
([`documents.md`](../skills/graphally/references/documents.md)).
[Brief](governance/brief.md) · [source](governance/diagram.html) · [SVG](governance/diagram.svg)

### Scope target

<picture><source media="(prefers-color-scheme: dark)" srcset="scope/diagram-dark.png"><img alt="What the proposal covers" src="scope/diagram.png"></picture>

Certainty as rings: in scope at the centre, phase-2 options around it, out of scope
struck through on the outside. Four areas split by spokes, a ruler naming the rings, and
the headline numbers in the corners.
**Technique:** the rings are `semicircle` shapes stacked in one corner; a five-line
before-script places each item by its angle and distance from the centre
([`documents.md`](../skills/graphally/references/documents.md)).
[Brief](scope/brief.md) · [source](scope/diagram.html) · [SVG](scope/diagram.svg)

### Solution stack

<picture><source media="(prefers-color-scheme: dark)" srcset="stack/diagram-dark.png"><img alt="The solution, layer by layer" src="stack/diagram.png"></picture>

The platform as five layers, from the landing zone up to what customers use, each with
the services it is built from, and the work that runs across every layer beside them.
**Technique:** the grid puts an empty cell beside each layer's card; the script draws an
isometric slab around each cell, bottom first, in shades mixed from the theme tokens
([`documents.md`](../skills/graphally/references/documents.md)).
[Brief](stack/brief.md) · [source](stack/diagram.html) · [SVG](stack/diagram.svg)

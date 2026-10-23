# Phase and role charts, matrices, anything else

Any figure is a grid. A phase and role chart has a label column and one column per stage;
rows are what happens in each stage. Bands of cards line up with the stages through
`subgrid`. Gates and other marks on a boundary come from the drawing script, placed from
the elements on either side.

```html
<diagram width=1300 title="Who does what" subtitle="From discovery to release">
<style>
  .lab { display: flex; flex-direction: column; justify-content: center; padding: 0 14px; border-radius: 8px; background: var(--wash); font-weight: 600; }
  .lab small { font-weight: 400; color: var(--muted); }
  .phase { height: 44px; margin: 0 -6px; border: 0; color: var(--card); font-weight: 700; }
  .stage { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50px; border-radius: 8px; background: var(--wash); font-weight: 600; }
  .stage small { font-weight: 400; color: var(--muted); }
  .strip { grid-column: 2 / -1; display: grid; grid-template-columns: subgrid; margin: 0 -6px; padding: 10px 6px; border-radius: 10px; }
  .strip .card { border: 0; }
  .strip .card small { display: block; margin-top: 4px; color: var(--muted); }
</style>
<div class="grid grid-cols-[160px_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-2 mx-[6px]">
  <div class=lab>Phase</div>
  <div class="phase col-[2/4] ml-0 bg-woad" shape=chevron-start>1&nbsp; Discover</div>
  <div class="phase col-[4/6] mr-0 bg-teal" shape=chevron id=p2>2&nbsp; Build</div>

  <div class=lab>Stage</div>
  <div class=stage id=s0>Align<small>week 1</small></div>
  <div class=stage id=s1>Design<small>weeks 2-3</small></div>
  <div class=stage id=s2>Implement<small>weeks 4-7</small></div>
  <div class=stage id=s3>Release<small>week 8</small></div>

  <div class="lab mt-3">Customer<small>what they bring</small></div>
  <div class="strip mt-3 bg-lane-a">
    <div class=card id=c0>Sponsor<small>Agrees the goal</small></div>
    <div class=card id=c1>Owners<small>Share how work is done</small></div>
    <div class=card id=c2>Testers<small>Try each build</small></div>
    <div class=card id=c3>Owners<small>Accept the release</small></div>
  </div>
  <div class=lab>Provider<small>what they bring</small></div>
  <div class="strip bg-lane-b">
    <div class=card id=v0>Lead<small>Runs the workshop</small></div>
    <div class=card id=v1>Architect<small>Designs the system</small></div>
    <div class=card id=v2>Engineers<small>Build in sprints</small></div>
    <div class=card id=v3>Engineers<small>Ship and support</small></div>
  </div>
</div>
<script type="graphally">
// A gate on the boundary after stage 1: the middle of the gap between two stages.
const edge = i => mid(el('s' + i).right, el('s' + (i + 1)).left).x;
gate(pt(edge(1), el('p2').center.y), 'G1', { size: 30 });
for (let i = 0; i < 4; i++) arrow(el('c' + i).bottom, el('v' + i).top, { color: 'muted' });
</script>
</diagram>
```

## How to

- **Columns are stages**: `grid-cols-[160px_repeat(N,minmax(0,1fr))]`, a label column and
  N equal columns. Phase bars span their stages (`col-[2/4]`) with `shape=chevron`;
  the first one `chevron-start`.
- **Bands that line up with the stages**: `grid-column: 2 / -1; display: grid;
  grid-template-columns: subgrid`. Each card in the band falls into its stage's column.
- **Boundaries**: the x of the boundary after stage i is `mid(el(si).right, el(si+1).left).x`.
  Put gates, dividers or a loop marker there with `gate`, `draw` or `shape`.
- **A centred card over two stages** (a decision between them): span the two columns and
  `justify-self-center` with a width: `col-[3/5] justify-self-center w-[260px]`.
- **A spine behind a row of cards** (a flow line through a band): an absolutely placed
  element first in the band (`absolute left-0 right-0 top-1/2 h-[3px] bg-woad`), cards
  after it with `position: relative`; the script's drawings paint above the page, so a
  line that must pass behind boxes belongs in the page.
- **Matrices** are a grid with a header row and column; **step cards** a flex row with
  `arrow` between neighbours.
- **Colours of your own** belong in CSS variables on the container, so one change recolours
  the chart; theme tokens follow the dark theme, hex colours do not.

## Pitfalls

- Explicit rows (`row-[4]`) count every row above, the title too: prefer auto placement.
- A class of yours named like a building block (`band`, `group`, `node`) gets its look too.

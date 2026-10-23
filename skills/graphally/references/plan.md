# Plans: Gantt charts and roadmaps

Tasks carry dates; `schedule()` works out the dates that follow from others, and
`timeline()` turns the plan into a grid with one column per day, so each bar's left edge is
its start date. Nothing about a date is computed by hand. Dependencies are drawn by
`depend()`, which keeps the lines off the bars.

```html
<diagram width=1300 title="Move to AKS" subtitle="First half of 2026">
<style>
  .row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; height: 40px; border-bottom: 1px solid var(--line); }
  .cells { grid-column: lead; display: grid; grid-template-columns: 1fr 90px; padding: 0 14px; font-size: 12.5px; }
  .cells > span { color: var(--muted); }
  .bar { position: relative; height: 20px; overflow: hidden; border: 1.3px solid var(--woad); border-radius: 4px; background: var(--card); }
  .bar > i { position: absolute; top: 0; bottom: 0; left: 0; background: var(--icon-soft); }
  .bar.critical { background: var(--woad); }
  .bar.blocked { border: 1.5px dashed var(--rust); background: var(--lane-d); }
  .ms { justify-self: start; width: 18px; height: 18px; min-height: 0; padding: 0; border: 0; background: var(--ink); translate: -9px 0; }
  .month { position: absolute; top: 0; bottom: 0; left: 0; border-left: 1px dashed var(--line); }
</style>
<div id=plan class="relative grid border border-line">
  <div class="row-[1] col-[lead] px-[14px] py-1 text-sm font-semibold text-muted">Task</div>
  <div class=row><div class=cells><b>Hub network</b><span>Network</span></div>
    <i class=bar id=hub data-start=2026-01-05 data-end=2026-01-30><i class="w-full"></i></i></div>
  <div class=row><div class=cells><b>Firewall approval</b><span>Security</span></div>
    <i class="bar blocked" id=fw data-start=2026-01-19 data-end=2026-02-27></i></div>
  <div class=row><div class=cells><b>AKS cluster</b><span>Platform</span></div>
    <i class="bar critical" id=aks data-after=hub data-duration=3w></i></div>
  <div class=row><div class=cells><b>Database</b><span>Platform</span></div>
    <i class=bar id=db data-start=2026-02-02 data-duration=4w><i class="w-[60%]"></i></i></div>
  <div class=row><div class=cells><b>Pilot</b><span>App team</span></div>
    <i class="bar critical" id=pilot data-after="aks fw" data-duration=3w></i></div>
  <div class="row border-b-0"><div class=cells><b>Go-live</b><span>Steering</span></div>
    <b shape=diamond class=ms id=live data-after=pilot data-duration=0d></b></div>
</div>
<script type="graphally" before>
schedule();
const t = timeline('#plan', { lead: '280px' });
const plan = el('#plan');
for (const m of t.months) plan.append(make('div', { class: 'py-1 px-2 text-sm bg-wash border-l border-line', style: `grid-row: 1; grid-column: ${m.column}` }, m.label));
plan.prepend(...t.months.slice(1).map(m => make('i', { class: 'month', style: `grid-column: ${m.column}` })));
</script>
<script type="graphally">
for (const b of all('[data-after]')) for (const d of b.el.dataset.after.split(' '))
  depend(d, b, d === 'fw' ? { color: 'rust', dashed: true } : {});
</script>
</diagram>
```

## How to

- **Dates** on any element: `data-start=2026-03-02`, `data-end=2026-04-30` (a boundary:
  the bar stops at the start of that day), `data-duration=5d` or `2w`, `data-after="a b"`
  (starts when the last of them ends), `data-at` for a single day.
- **`schedule()`** resolves them; **`timeline('#plan', { lead: '280px' })`** makes `#plan` a
  grid: a `lead` column for the task table, then one column per day from the start of the
  first month to after the last date (`from`, `to` set it; `unit: 'week'` for long plans).
  It returns `months`, `quarters` and `years`, each with a `label` and a `column`, to make
  header cells and month lines from.
- **One task per row**: a full-width subgrid row holds the task's cells in the lead column
  and its bar on its dates. Names belong in the table, not beside the bars, so the
  dependency lines have room.
- **Dependencies**: `depend(a, b)` in the drawing script, from the end of `a` to the start
  of `b`. Draw only the ones that tell the story (the critical path, a blocker); a task
  that is only scheduled by date needs no arrow.
- **Progress** is a child of the bar with a width: `<i class="w-[60%]"></i>`. **Critical
  path**, **blocked**, **external** and **done** are classes of yours, in theme colours.
- **Milestones**: a small diamond (`shape=diamond`) with `data-at` or `data-after` and
  `data-duration=0d`.
- **A today line**: `<i class=today data-at=2026-03-02>` placed absolutely
  (`top: 0; bottom: 0; width: 0`), drawn by the script:
  `draw.moveTo(el('.today').top).lineTo(el('.today').bottom).style({ color: 'rust', width: 2 })`.

## Roadmaps

The same dates with a lighter look: lanes of chevrons (`shape=chevron`, `border: 0`, a
background per workstream), quarters and months on top, cross-lane dependencies as dashed
`connect` lines. A label too long for its chevron goes beside it in an absolutely placed
`<span>`.

## Pitfalls

- Colours written as hex stay light in the dark theme: use the tokens (`var(--lane-b)`,
  `var(--icon-soft)`).
- A milestone shrinks to its one-day column unless it has `width: max-content` or a fixed size.

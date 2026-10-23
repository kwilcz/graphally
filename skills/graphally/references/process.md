# Processes: BPMN and flowcharts

A process is a grid: one column per step, in the order the flow runs, and for BPMN one row
per lane. A step's column says when it happens, its lane says who does it. Events,
gateways and tasks are shapes; the sequence flows are connections.

```html
<diagram width=1400 title="Expense claim" subtitle="Finance operations">
<style>
  .lane { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; padding: 24px 0; border-bottom: 1px solid var(--line); }
  .lane > h4 { grid-column: 1; align-self: stretch; display: flex; align-items: center; margin: -24px 0; padding: 0 14px; font-size: 12px; }
  [shape=task] { width: 140px; min-height: 52px; font-weight: 500; position: relative; }
  [shape=task] small { display: block; font-size: 11px; font-weight: 400; color: var(--muted); }
  .ev, .gw { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100px; text-align: center; font-size: 11.5px; }
  .gw { translate: 0 10px; }
</style>
<div class="grid grid-cols-[120px_repeat(6,auto)] justify-between gap-x-8 border border-line">
  <div class=lane><h4 class=bg-lane-a>Employee</h4>
    <div class="ev col-[2]"><i shape=start id=s></i>Expense incurred</div>
    <div shape=task class="col-[3]" id=submit>Submit claim<small>with receipts</small></div>
    <div class="ev col-[7]"><i shape=end id=paid></i>Claim paid</div>
  </div>
  <div class=lane><h4 class=bg-lane-b>Manager</h4>
    <div shape=task class="col-[4]" id=review>Review claim<i shape="event timer" class="absolute -bottom-[18px] right-[14px]" id=late></i></div>
    <div class="gw col-[5]"><i shape="gateway exclusive" id=ok></i>Approved?</div>
  </div>
  <div class="lane border-b-0"><h4 class=bg-lane-c>Finance</h4>
    <div shape=task class="col-[4]" id=remind>Send reminder</div>
    <div shape=task class="col-[6]" id=pay>Schedule payment<small>next payment run</small></div>
  </div>
</div>
<script type="application/json">
[
  ["s", "submit"], ["submit", "review"], ["review", "ok"],
  ["ok", "pay", "yes"],
  { "from": "late", "to": "remind", "label": "3 days", "out": "bottom" },
  { "from": "remind", "to": "review", "label": "reminder", "dashed": true, "in": "bottom" },
  { "from": "pay", "to": "paid", "label": "payment", "dashed": true }
]
</script>
</diagram>
```

## How to

- **Columns follow the flow.** `grid-cols-[120px_repeat(N,auto)] justify-between`: a label
  column, then one column per step. Each item takes its column with `col-[4]`; two items
  in one column happen at the same time.
- **Lanes** are full-width subgrid rows (`.lane` above) with the lane name in the first
  column. A lane with two paths gets two rows inside it: `row-[1]`, `row-[2]` on its items.
- **Events and gateways** carry a caption: a wrapper (`.ev`, `.gw`) holds the shape and the
  text. Put a gateway's caption below it when its branches leave from the top, above it
  (`flex-direction: column-reverse`) when they leave from the bottom.
- **A boundary event** is a child of its task, placed on the border:
  `<i shape="event timer" class="absolute -bottom-[18px] right-[14px]" id=late>` inside a
  task with `position: relative`. Lines may leave from it.
- **Branches** are connections with labels (`yes`, `no`); give the branch that leaves
  sideways `"out": "top"` or `"out": "bottom"`.
- **Message flows** between pools: `{ "from": "a", "to": "b", "message": true }` (dashed, an
  open circle at the source). Within one pool, a dashed connection reads as a notice.

## Flowcharts

The same grid without lanes: the happy path runs along the middle row, and every failure
branches to the row above (`row-[1]`), so the reader can follow the main line and see each
way out. A task with an icon: `<div shape=task><icon name=user></icon>Approve</div>` with
the icon placed absolutely in the corner and `padding-left` on the task.

## Pitfalls

- Captions under gateways block the bottom side: a branch that must leave downward gets
  its gateway's caption above.
- Equal-width columns make long flows too wide: `auto` columns with `justify-between`
  spend the width on the gaps.
- If a line detours far round, it is usually avoiding a crossing: try another `in` side.

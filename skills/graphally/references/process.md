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
- **A task's type** is a marker: `shape="task user"` (a person does it), `service` (a system
  does it), `send` and `receive` (a message), `manual`, `script`, `business-rule`. Mark the
  tasks whose type the reader needs; a plain `task` says nothing more.
- **Events say what they wait for or send:** the trigger after the shape name
  (`event timer`, `end message`), `throw` for an intermediate event that sends
  (`event message throw`), and `non-interrupting` for a boundary event that lets its task
  carry on (`event timer non-interrupting`, dashed).
- **Activity variants** are markers and borders: `subprocess transaction` (double border),
  `subprocess ad-hoc` (~, steps in any order), `task compensation` (⏪, undoes another task).
  A call activity is a task with a thick border (`style="border-width: 3px"`), an event
  subprocess a subprocess with a dotted one (`style="border-style: dotted"`).
- **Notes and groupings** are artifacts. A text annotation is `<div shape=annotation id=n>…</div>`,
  joined to what it explains by a dotted line without a head:
  `{ "from": "n", "to": "review", "dotted": true, "arrow": false }` (with `out` and `in` when it
  would run along a flow). A group,
  `<div shape=group>`, wraps related items in a dash-dot box; it changes no flow.
- **Data** a step reads or writes is `shape=data-object` (the folded page), joined by a dotted
  line with an open head: `{ "from": "form", "to": "review", "dotted": true, "head": "open" }`.
  Mark it `input` or `output` when the process takes it in or hands it out, `collection` when it
  is a list. A store that outlives the process is `shape=cylinder`.
- **Choose the gateway by what decides.** Data decides at `gateway exclusive` (one branch),
  `gateway inclusive` (one or more) or `gateway complex` (a rule the caption states). An
  event decides at `gateway event-based`: the process waits, and the first event to happen
  takes its branch, so each branch starts with a catching event (`event message`, `event
  timer`, `event signal`) or a receive task. `gateway parallel` splits or joins without a
  decision.
- **The default branch** of an exclusive or inclusive gateway, taken when no condition holds:
  `{ "from": "ok", "to": "retry", "label": "otherwise", "default": true }` (a slash at the
  source). A flow with a condition straight out of a task: `"conditional": true` (an open
  diamond at the source).
- **Message flows** between pools: `{ "from": "a", "to": "b", "message": true }` (dashed, an
  open circle at the source). Within one pool, a dashed connection reads as a notice.

## Waiting for a response

A call to another system waits for one of two events, then decides on the data: an
event-based gateway between the response and a timeout, then an exclusive gateway on the
status. Captions sit outside the layout (`position: absolute`), so every shape centres on
its row and the branches leave from any side.

```html
<diagram width=1000 title="Call the payment API" subtitle="Wait for the first event, then decide on the data">
<style>
  [shape=task] { width: 130px; min-height: 52px; font-weight: 500; }
  .ev, .gw { position: relative; display: grid; justify-items: center; width: 96px; text-align: center; font-size: 11.5px; }
  .ev span { position: absolute; top: calc(100% + 4px); }
  .gw span { position: absolute; bottom: calc(100% + 4px); }
</style>
<div class="grid grid-cols-[repeat(6,auto)] grid-rows-[auto_auto] items-center justify-between gap-y-10">
  <div shape=task class="col-[1] row-[1]" id=call>Call payment API</div>
  <div class="gw col-[2] row-[1]"><i shape="gateway event-based" id=wait></i><span>first to happen</span></div>
  <div class="ev col-[3] row-[1]"><i shape="event message" id=resp></i><span>response received</span></div>
  <div class="gw col-[4] row-[1]"><i shape="gateway exclusive" id=status></i><span>status?</span></div>
  <div shape=task class="col-[5] row-[1]" id=ok>Confirm order</div>
  <div shape=task class="col-[5] row-[2]" id=bad>Reject payment</div>
  <div class="ev col-[3] row-[2]"><i shape="event timer" id=timeout></i><span>30 s, no response</span></div>
  <div shape=task class="col-[4] row-[2]" id=retry>Retry later</div>
</div>
<script type="application/json">
[
  ["call", "wait"], ["wait", "resp"], ["resp", "status"],
  ["status", "ok", "200"],
  { "from": "status", "to": "bad", "label": "400", "out": "bottom" },
  { "from": "wait", "to": "timeout", "out": "bottom" },
  ["timeout", "retry"]
]
</script>
</diagram>
```

A 200 and a 400 are both a response: the same event, told apart by its data, so they
branch at the exclusive gateway, not the event-based one.

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

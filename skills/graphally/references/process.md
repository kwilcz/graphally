# Processes: BPMN and flowcharts

Two notations with rules of their own. A reader who knows them reads the figure at once, so keep
their rules exactly: the look comes from the layout, the lanes and the space, not from new
shapes or colours. A process is a grid: one column per step, in the order the flow runs, and
for BPMN one row per lane. A step's column says when it happens, its lane who does it.

## BPMN: the rules

BPMN 2.0 (OMG; ISO/IEC 19510), with the labelling of Silver's *BPMN Method and Style*:

- **Shapes.** A start event is a thin circle, an intermediate event a double circle, an end
  event a thick one; a task is a rounded rectangle; a gateway a diamond with its marker (×
  exclusive, + parallel, ○ inclusive). Use the shapes `shape=` names; draw no others for these.
- **Pools and lanes.** A pool is one participant (an organisation, a system); its lanes are the
  roles inside it. The pool's name stands in a band at its left, read upward, and so does each
  lane's.
- **Sequence flows** (solid, a filled head) join the steps inside one pool: they may cross
  lanes, never a pool's border. **Message flows** (dashed, an open circle at the start, an open
  head) run only between pools.
- **Labels.** A task is a verb and an object, in sentence case ("Check completeness"). A
  gateway that splits asks a question ("Complete?"), and each flow out of it carries an answer
  ("yes", "no", "over 10,000 EUR"). Every path ends in an end event named for the state it ends
  in ("Claim paid", "Claim closed").
- **Waiting and time** are events: a timer on a task's border for a deadline, an event-based
  gateway when the process waits for the first of several events.
- **Joins match splits**: paths that a parallel gateway split meet again at a parallel one.
- **Colour carries no meaning** in BPMN: shapes stay outlined in ink on the card, lanes may be
  tinted, and anything coloured beyond that is named in a key.
- **Flow left to right**, lines orthogonal, crossings avoided.
- **Compact.** A lane is as low as its content (padding 16 to 24px, one row unless it holds two
  paths at once). A step takes the column after the one it follows; the alternatives after a
  gateway share columns in their own lanes; so the figure is as wide as its longest path, and
  no lane stands mostly empty.
- **Long processes.** At a README's width about nine columns stay legible. A longer process
  keeps its main phases on one figure and folds the detail of a phase into a collapsed
  `subprocess` (its + marker), drawn in a figure of its own, when the reader needs both.

```html
<diagram width=1200 title="Expense claim process">
<style>
  .pool { display: flex; border: 1.5px solid var(--ink); }
  .pool > b, .lane > h4 { writing-mode: sideways-lr; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; }
  .pool > b { width: 30px; border-right: 1.5px solid var(--ink); }
  .lanes { flex: 1; display: grid; grid-template-columns: 30px repeat(6, auto); justify-content: space-between; column-gap: 24px; }
  .lane { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; padding: 36px 24px 36px 0; border-bottom: 1px solid var(--ink); }
  .lane:last-child { border-bottom: 0; }
  .lane > h4 { grid-column: 1; align-self: stretch; margin: -36px 0; border-right: 1px solid var(--ink); }
  [shape^=task] { width: 132px; min-height: 52px; position: relative; }
  .ev, .gw { position: relative; display: grid; justify-items: center; width: 96px; text-align: center; font-size: 12px; }
  .ev span { position: absolute; top: calc(100% + 4px); }
  .gw span { position: absolute; bottom: calc(100% + 4px); }
  .bank { margin-top: 56px; border: 1.5px solid var(--ink); padding: 12px; text-align: center; font-weight: 600; }
</style>
<div class=pool>
  <b>Northwind</b>
  <div class=lanes>
    <div class=lane><h4>Employee</h4>
      <div class="ev col-[2]"><i shape=start id=start></i><span>Expense incurred</span></div>
      <div shape=task class="col-[3]" id=submit>Submit claim</div>
    </div>
    <div class=lane><h4>Manager</h4>
      <div shape="task user" class="col-[4]" id=review>Review claim<i shape="event timer non-interrupting" class="absolute -bottom-[18px] right-[14px]" id=late></i></div>
      <div class="gw col-[5]"><i shape="gateway exclusive" id=approved></i><span>Approved?</span></div>
      <div class="ev col-[6]"><i shape=end id=rejected></i><span>Claim rejected</span></div>
    </div>
    <div class=lane><h4>Finance</h4>
      <div shape="task send" class="col-[4]" id=remind>Send reminder</div>
      <div class="ev col-[5]"><i shape=end id=reminded></i><span>Reminder sent</span></div>
      <div shape="task service" class="col-[6]" id=pay>Schedule payment</div>
      <div class="ev col-[7]"><i shape=end id=paid></i><span>Claim paid</span></div>
    </div>
  </div>
</div>
<div class=bank id=bank>Bank</div>
<script type="application/json">
[
  ["start", "submit"], ["submit", "review"], ["review", "approved"],
  { "from": "approved", "to": "rejected", "label": "no" },
  { "from": "approved", "to": "pay", "label": "yes", "out": "bottom", "in": "top" },
  { "from": "late", "to": "remind", "label": "3 days", "out": "bottom", "in": "top" },
  ["remind", "reminded"], ["pay", "paid"],
  { "from": "pay", "to": "bank", "label": "payment order", "message": true }
]
</script>
</diagram>
```

## How to

- **Columns follow the flow.** `grid-template-columns: 30px repeat(N, auto)` with
  `justify-content: space-between`: the lane's name band, then one column per step. Each item
  takes its column with `col-[4]`; two items in one column happen at the same time.
- **A pool and its lanes.** The pool is a flex row: its name in a band at the left
  (`writing-mode: sideways-lr`, read upward), then the lanes, full-width subgrid rows with their
  names in the same kind of band. A lane with two paths gets two rows inside it: `row-[1]`,
  `row-[2]` on its items and `row-span-2` on its name, whose band otherwise covers the first row
  only. Another participant (a customer, a bank) is a pool of its own; when
  its inside does not matter, a bar with its name (a black-box pool), joined by message flows.
- **Events and gateways** carry a caption: a wrapper (`.ev`, `.gw`) holds the shape and a
  `<span>` hung outside the layout (`position: absolute`), below an event and above a gateway,
  so every shape centres on its row and the flows run straight.
- **A boundary event** is a child of its task, placed on the border:
  `<i shape="event timer" class="absolute -bottom-[18px] right-[14px]" id=late>` inside a
  task with `position: relative`. Lines may leave from it.
- **Branches** are connections with labels; give the branch that leaves downward
  `"out": "bottom"`.
- **A task's type** is a marker: `shape="task user"` (a person does it), `service` (a system
  does it), `send` and `receive` (a message), `manual`, `script`, `business-rule`. Mark the
  tasks whose type the reader needs; a plain `task` says nothing more. The marker takes the
  top-left corner and the task keeps 26px of `padding-left` for it; a `padding` rule of yours
  takes that back.
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
  open circle at the source); never inside one pool, where a hand-off is a sequence flow. Flows
  into a black-box pool meet it straight above each step, as connections, with no script.

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

## Flowcharts: the rules

A flowchart uses the symbols of ISO 5807 (ANSI X3.5), without lanes unless the user asks for a
cross-functional one, and without BPMN's events and gateways:

- **Symbols.** `terminator` (a stadium) starts and ends the flow; `rect` is a step; `decision`
  (a diamond) a question; `io` (a parallelogram) data read or written; `predefined` (a rectangle
  with double sides) a process defined elsewhere; `document` a printed or generated document;
  `cylinder` stored data; `manual-input` as it says; `off-page` and a small `circle` connect
  to another page or another part. `delay` (a D shape) is not in ISO 5807 but is widely read
  as a wait: a time limit is a `delay` ("Wait up to 24 h for approval") and then a decision.
- **Flowlines** carry an arrowhead and run top to bottom or left to right; they join a symbol at
  one entry and avoid crossing.
- **A decision** has one entry and two or more exits, each labelled with its answer ("yes",
  "no", "above 2%").
- **Every path ends** at a terminator; a step is an imperative ("Read order lines"), a decision
  a question ("In stock?").
- **The main path runs straight** down one column, its branches to the side they leave by, each
  on its decision's row; with all branches on one side, the main path is the first column. Colour, when it is
  used, means one thing (a failure path in red) and the figure says so.

```html
<diagram width=850 title="Order handling">
<style>
  .flow { display: grid; grid-template-columns: repeat(3, 240px); column-gap: 64px; row-gap: 36px; justify-items: center; align-items: center; font-size: 15px; }
  .flow > [shape] { width: 220px; min-height: 52px; text-align: center; }
  .flow > [shape=decision] { width: 200px; min-height: 96px; }
</style>
<div class=flow>
  <div shape=terminator class="col-[2]" id=start>Order received</div>
  <div shape=io class="col-[2]" id=read>Read order lines</div>
  <div shape=decision class="col-[2]" id=stock>In stock?</div>
  <div shape=rect class="col-[3] row-[3]" id=backorder>Back-order the items</div>
  <div shape=terminator class="col-[3] row-[4]" id=held>Order on hold</div>
  <div shape=predefined class="col-[2] row-[4]" id=pay>Take payment</div>
  <div shape=decision class="col-[2]" id=paid>Payment accepted?</div>
  <div shape=rect class="col-[1] row-[5]" id=cancel>Cancel the order</div>
  <div shape=document class="col-[2]" id=slip>Print packing slip</div>
  <div shape=terminator class="col-[2]" id=done>Order shipped</div>
  <div shape=terminator class="col-[1] row-[7]" id=cancelled>Order cancelled</div>
</div>
<script type="application/json">
[
  ["start", "read"], ["read", "stock"],
  { "from": "stock", "to": "pay", "label": "yes" },
  { "from": "stock", "to": "backorder", "label": "no" },
  ["pay", "paid"],
  { "from": "paid", "to": "slip", "label": "yes" },
  { "from": "paid", "to": "cancel", "label": "no" },
  ["slip", "done"], ["cancel", "cancelled"], ["backorder", "held"]
]
</script>
</diagram>
```

A step with an icon: `<div shape=rect><icon name=user></icon>Approve</div>`, the icon placed
absolutely in the corner and `padding-left` on the step.

## Pitfalls

- Captions under gateways block the bottom side: a branch that must leave downward gets
  its gateway's caption above.
- `justify-content: space-between` hands the spare width to the gaps, and a flow whose branches
  all leave one way sits wide and empty: give the columns a fixed `column-gap` and set `width`
  to what they need.
- If a line detours far round, it is usually avoiding a crossing: try another `in` side.

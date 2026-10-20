# Process diagrams

`<diagram layout=lanes>` draws BPMN-style swimlanes; `<diagram layout=flow>` draws a
flowchart without lanes. Columns follow the order of the links, so you never place
anything: list the steps, then link them.

```html
<diagram layout=lanes title="Order fulfilment">
  <lane id=customer label="Customer">
    <start id=s>Order placed</start>
    <end id=done>Order received</end>
  </lane>
  <lane id=shop label="Web shop">
    <task id=pay icon=api>Take payment</task>
    <gateway id=paid>Paid?</gateway>
    <task id=cancel>Cancel order</task>
  </lane>
  <lane id=wh label="Warehouse">
    <task id=pick icon=user>Pick and pack</task>
    <event id=wait type=timer>Courier collects</event>
    <task id=ship>Ship</task>
  </lane>
  <links>
  s -> pay -> paid
  paid -> pick : yes
  paid -> cancel : no
  pick -> wait -> ship
  ship ~> done : parcel
  </links>
</diagram>
```

| Element | Draws |
|---|---|
| `<start>` / `<end>` | thin / thick circle, label below |
| `<event type=timer\|message\|signal>` | double circle with a symbol |
| `<event type=timer on=task>` | boundary event on the task's border (a timeout, an error); link it onward |
| `<task>` | rounded box; optional `icon` (top left) and `Name \| note` |
| `<subprocess>` | task with a + marker |
| `<gateway type=exclusive\|parallel\|inclusive>` | diamond with ×, + or ○ |
| `<lane label=…>` | a swimlane; its title sits in the left column |

- Order steps inside a lane in the order they happen.
- `~>` is a message between lanes or participants (dashed); `->` is sequence flow.
- Label gateway branches (`yes`, `no`, `> £500`); the label sits near the gateway.
- For an approval loop, link back to an earlier step; the loop is drawn without moving the
  earlier step.
- A deadline or timeout on a step is a boundary event: `<event id=late type=timer on=review>3 days</event>`
  then `late -> remind`. Do not link the step to it.

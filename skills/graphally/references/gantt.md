# Plans and timelines

`<diagram layout=gantt>` draws a Gantt chart: one row per task, lanes as bands, the time
axis on top, dependencies as arrows. Dates are `YYYY-MM-DD`; plain numbers work too (add
`unit="min"` to label the axis).

```html
<diagram layout=gantt today=2026-03-02 title="Migration plan">
  <lane label="Network">
    <task id=hub start=2026-01-05 end=2026-01-30 done>Hub VNet and VPN</task>
    <task id=spoke after=hub duration=2w>Spoke VNets</task>
  </lane>
  <lane label="Platform">
    <task id=aks after=spoke duration=3w accent>AKS cluster</task>
    <milestone id=live at=2026-04-01>Go-live</milestone>
  </lane>
  <links>
  hub -> spoke -> aks -> live
  </links>
</diagram>
```

| Attribute | Means |
|---|---|
| `start`, `end` | dates or numbers |
| `after=a,b` | starts when the last of these ends |
| `duration=10d`, `3w`, `5` | length (days, weeks, or plain units) |
| `done` | finished: grey |
| `accent` | the critical task: filled |
| `external` | tentative or outside the team: dashed |
| `<milestone at=…>` | a diamond |
| `today=…` on `<diagram>` | a red line at that date |

The label sits inside a bar when it fits, else just after it. `after=` only sets the
timing; arrows come from `<links>`, so link every dependency you want drawn.

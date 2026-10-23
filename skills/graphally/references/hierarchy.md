# Hierarchies

Management groups, org charts, module trees. Give the grid one column per leaf and one row
per level; a parent spans the columns of its children, so it sits centred over them without
any arithmetic. A connection from a parent to a list of children draws one bus.

```html
<diagram width=1000 title="Management groups" subtitle="Azure tenant">
<style>
  .lab { grid-column: 1; justify-self: start; align-self: start; padding: 12px; font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .subs { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 18px 0; }
</style>
<div class="grid grid-cols-[150px_repeat(5,1fr)] grid-rows-[110px_110px_auto] place-items-center">
  <div class="row-[1] col-span-full self-stretch justify-self-stretch my-1 rounded-lg bg-wash"></div>
  <div class="row-[2] col-span-full self-stretch justify-self-stretch my-1 rounded-lg bg-wash"></div>
  <div class="row-[3] col-span-full self-stretch justify-self-stretch my-1 rounded-lg bg-wash"></div>
  <div class="lab row-[1]">Root</div>
  <div class="lab row-[2]">Management groups</div>
  <div class="lab row-[3]">Subscriptions</div>

  <div class="figure row-[1] col-[2/-1]" id=root><icon name=mg></icon>Contoso</div>
  <div class="figure row-[2] col-[2/4]" id=platform><icon name=mg></icon>Platform</div>
  <div class="figure row-[2] col-[4/6]" id=lz><icon name=mg></icon>Landing zones</div>
  <div class="figure row-[2] col-[6]" id=sandbox><icon name=mg></icon>Sandbox</div>

  <div class="subs row-[3] col-[2] self-start"><div class=figure id=s1><icon name=subscription></icon>Connectivity</div></div>
  <div class="subs row-[3] col-[3] self-start"><div class=figure id=s2><icon name=subscription></icon>Identity</div></div>
  <div class="subs row-[3] col-[4] self-start"><div class=figure id=s3><icon name=subscription></icon>Payroll</div><div class=figure id=s4><icon name=subscription></icon>HR portal</div></div>
  <div class="subs row-[3] col-[5] self-start"><div class=figure id=s5><icon name=subscription></icon>E-commerce</div></div>
  <div class="subs row-[3] col-[6] self-start"><div class=figure id=s6><icon name=subscription></icon>Team A</div></div>
</div>
<script type="application/json">
[
  { "from": "root", "to": ["platform", "lz", "sandbox"], "out": "bottom", "in": "top" },
  { "from": "platform", "to": ["s1", "s2"], "out": "bottom", "in": "top" },
  { "from": "lz", "to": ["s3", "s5"], "out": "bottom", "in": "top" },
  { "from": "sandbox", "to": "s6", "out": "bottom", "in": "top" }
]
</script>
</diagram>
```

## How to

- **Columns are leaves.** Count the leaves; `grid-cols-[150px_repeat(N,1fr)]` gives a label
  column and one column per leaf. A parent spans its children: `col-[2/4]` covers columns
  2 and 3.
- **Rows are levels**, with a fixed height each (`grid-rows-[110px_110px_auto]`); level
  bands are full-width cells with a background, laid in the same rows, and labels sit in
  the first column.
- **Buses**: one connection with a list of children,
  `{ "from": "lead", "to": ["a", "b", "c"], "out": "bottom", "in": "top" }`, draws one trunk
  down and a branch to each.
- **A column of children** (several subscriptions under one group) is a flex column in one
  cell (`.subs`), and the connection `"in": "left"` draws a comb into their left sides.
- **`figure`** is an icon over its name: the usual box for a tree. `node` works for org
  charts with a role line in `<small>`.

## Pitfalls

- A parent that spans the wrong columns sits off-centre: make its span exactly its
  children's columns.
- Do not nudge boxes to centre them; fix the span.

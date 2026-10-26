# Figures for proposals and solution designs

A proposal, a statement of work or a solution design needs figures that look designed: a
governance pyramid, a scope target, a solution drawn as layers. They are still a grid with
text in boxes; three techniques give them their shape. Reach for them in this order:

1. **`clip-path: polygon(…)`** cuts any box into a straight-edged shape, in CSS.
2. **A before-script that places elements by angle and distance** makes a radial layout.
3. **The drawing script** draws geometry around empty cells the layout placed: 3D slabs,
   spokes, arrows along a slope.

Complete versions of all three, with briefs: the `governance`, `scope` and `stack` samples
at https://github.com/kwilcz/graphally/tree/main/samples.

## A shape cut in CSS: the governance pyramid

The client's levels on the left, the partner's on the right, the forum where each level
meets its counterpart in the middle. Every tier is a full-width box in its grid cell, cut
by `clip-path`; together the tiers make one pyramid split down the middle.

```html
<diagram width=1000 title="How we work together" subtitle="Client and partner, level by level">
<style>
  .gov { display: grid; grid-template-columns: 1fr 200px 1fr; grid-template-rows: repeat(3, 76px); }
  .tier { display: flex; flex-direction: column; justify-content: center; padding: 0 18px; font-size: 12px; }
  .tier b { font-size: 13.5px; }
  .client { align-items: flex-end; text-align: right; }
  .t1 { background: var(--ink); color: var(--card); }
  .t2 { background: var(--woad); color: var(--card); }
  .t3 { background: var(--lane-a); }
  /* One slope from the apex to the base: each tier starts where the one above it ends. */
  .client.t1 { clip-path: polygon(60% 0, 100% 0, 100% 100%, 40% 100%); }
  .client.t2 { clip-path: polygon(40% 0, 100% 0, 100% 100%, 20% 100%); }
  .client.t3 { clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%); }
  .partner.t1 { clip-path: polygon(0 0, 40% 0, 60% 100%, 0 100%); }
  .partner.t2 { clip-path: polygon(0 0, 60% 0, 80% 100%, 0 100%); }
  .partner.t3 { clip-path: polygon(0 0, 80% 0, 100% 100%, 0 100%); }
  .forum { justify-self: center; align-self: center; padding: 7px 16px; border-radius: 999px; background: var(--card); border: 1.5px solid var(--line); font-size: 12px; text-align: center; }
  .forum b { display: block; }
</style>
<div class=gov>
  <div class="tier client t1" id=c1><b>Sponsor</b>CIO</div>
  <div class=forum id=f1><b>Steering committee</b>quarterly</div>
  <div class="tier partner t1" id=p1><b>Account lead</b>partner</div>
  <div class="tier client t2" id=c2><b>Programme director</b>Head of Claims</div>
  <div class=forum id=f2><b>Programme board</b>monthly</div>
  <div class="tier partner t2" id=p2><b>Engagement manager</b>plan, budget, risks</div>
  <div class="tier client t3" id=c3><b>Product owners</b>Claims, Finance</div>
  <div class=forum id=f3><b>Sprint review</b>every two weeks</div>
  <div class="tier partner t3" id=p3><b>Delivery team</b>architects and engineers</div>
</div>
<script type="graphally">
for (const n of [1, 2, 3]) {
  arrow(el('c' + n).right, el('f' + n).left, { head: 'dot', tail: 'dot', color: 'line' });
  arrow(el('f' + n).right, el('p' + n).left, { head: 'dot', tail: 'dot', color: 'line' });
}
</script>
</diagram>
```

- **One slope**: with no gap between tiers, the slanted edge steps evenly. For three
  tiers it runs 60% → 40% → 20% → 0: each tier starts where the one above ends. With a
  gap between tiers, take each tier's values at its own top and bottom on one line from
  the apex to the base, or the edge breaks at every gap.
- **Percentages are of the box**, so the shape follows the column width. `px` and `calc()`
  work too: `polygon(0 0, calc(100% - 20px) 0, 100% 50%, …)`.
- **Text stays in the visible part**: align it toward the wide side (`text-align: right`
  on the left half) and keep it short enough for the narrowest tier.
- **Colour by level**, the same on both sides (`--ink`, `--woad`, `--lane-a`): the halves
  read as one pyramid, and the dark apex marks seniority.
- **Arrows along the outer slopes** (escalation up one side, decisions down the other)
  come from the script, between points on the tiers' corners:
  `const lo = el('c3').bottomLeft.left(28), hi = el('c1').topLeft.move(el('c1').w * 0.6 - 28, 0);
  arrow(lerp(lo, hi, 0.1), lerp(lo, hi, 0.8), { color: 'rust' })`. Leave the page a
  margin on that side, or the arrow runs past it (`page-overflow`).

## A radial layout: the scope target

Rings for certainty (in scope at the centre, options around it, out of scope outside) and
spokes for areas. The rings are `shape=semicircle` boxes stacked in one corner of the
container; the items are placed by angle and distance.

```html
<diagram width=900 title="What this proposal covers" subtitle="In scope at the centre, options around it, the rest outside">
<style>
  .fan { position: relative; height: 430px; }
  .fan > [shape=semicircle] { position: absolute; bottom: 0; left: 50%; translate: -50% 0; border: 0; }
  .outer { width: 800px; height: 400px; background: var(--wash); }
  .option { width: 580px; height: 290px; background: var(--icon-soft); }
  .scope { width: 360px; height: 180px; background: var(--woad); }
  .core { width: 140px; height: 70px; background: var(--ink); color: var(--card); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 12px; font-weight: 700; }
  /* Placed by the before-script: data-r is the distance from the centre, data-a the angle (0 right, 90 up). */
  .fan [data-r] { position: absolute; translate: -50% -50%; white-space: nowrap; }
  .chip { padding: 4px 10px; border-radius: 999px; background: var(--card); font-size: 12px; font-weight: 600; }
  .later { border: 1.3px dashed var(--woad); font-weight: 400; }
  .out { background: none; color: var(--muted); font-weight: 400; text-decoration: line-through; }
</style>
<div class=fan>
  <div class=outer shape=semicircle></div>
  <div class=option shape=semicircle></div>
  <div class=scope shape=semicircle></div>
  <div class=core shape=semicircle id=core>Platform</div>
  <span class=chip data-r=125 data-a=135>Customer portal</span>
  <span class=chip data-r=125 data-a=45>Claims intake</span>
  <span class="chip later" data-r=235 data-a=135>Chat assistant</span>
  <span class="chip later" data-r=235 data-a=45>Fraud scoring</span>
  <span class="chip out" data-r=345 data-a=135>Broker portal</span>
  <span class="chip out" data-r=345 data-a=45>Data warehouse</span>
</div>
<script type="graphally" before>
for (const e of all('.fan [data-r]')) {
  const r = Number(e.dataset.r), a = e.dataset.a * Math.PI / 180;
  e.style.left = `calc(50% + ${r * Math.cos(a)}px)`;
  e.style.top = `calc(100% - ${r * Math.sin(a)}px)`;
}
</script>
<script type="graphally">
// A spoke between the two areas, from the core to the outer ring.
draw.moveTo(el('core').top).lineTo(el('core').top.up(330)).style({ color: 'card', width: 3 });
</script>
</diagram>
```

- **Rings**: absolutely placed `semicircle` boxes, each twice as wide as it is high,
  bottom-centred (`bottom: 0; left: 50%; translate: -50% 0`), largest first so the smaller
  ones paint over it. A full target is the same with `border-radius: 50%` boxes centred
  on both axes.
- **Placing by angle**: `data-r` (distance from the centre in px) and `data-a` (degrees,
  0 to the right, 90 straight up) on each item; the before-script turns them into `left`
  and `top`, and `translate: -50% -50%` centres the item on its point. Copy the script as
  it is.
- **Choosing the points**: put an item in the middle of its ring band (`data-r` halfway
  between two radii) and its area (`data-a` halfway between two spokes). Two items in one
  band and area go one above the other: near the horizontal (angles near 0 and 180) vary
  `data-a`; near the vertical vary `data-r`.
- **Spokes** are drawn by the script from the core outwards, in `card` colour, so they read
  as gaps between the areas. Area names go outside the outer ring, placed like the items.
- **A ruler under the rings** (a grid row whose columns match the ring widths) names the
  rings without a legend.
- `line-through` on out-of-scope items (`text-decoration: line-through` or the
  `line-through` class) says "not this" in the text itself.

## Drawing on the layout: the solution stack

Each layer is a row: an empty cell on the left, where the script draws an isometric slab,
and a card on the right with what the layer holds. The layout decides where each layer
is; the script only draws around those points.

```html
<diagram width=1000 title="The solution, layer by layer" subtitle="Each layer and what it is built from">
<style>
  .stack { display: grid; grid-template-columns: 300px 1fr; grid-template-rows: repeat(3, 96px); column-gap: 24px; }
  .layer { align-self: center; padding: 10px 16px; border-radius: 8px; background: var(--card); border-left: 4px solid; font-size: 12px; color: var(--muted); }
  .layer b { display: block; font-size: 14px; color: var(--ink); }
</style>
<div class=stack>
  <i class=slab></i><div class="layer border-woad"><b>Experience</b>mobile app, customer portal</div>
  <i class=slab></i><div class="layer border-purple"><b>Applications</b>claims service, rules engine</div>
  <i class=slab></i><div class="layer border-muted"><b>Landing zone</b>network, identity, policy</div>
</div>
<script type="graphally">
// An isometric slab around each empty .slab cell, drawn from the bottom up so each one sits
// on the one below. A: half width, B: half depth, T: thickness.
const A = 130, B = 50, T = 18;
const tone = [['woad', 'lane-a'], ['purple', 'lane-c'], ['muted', 'wash']];
const face = (pts, fill) => {
  let p = draw.moveTo(pts[0]);
  for (const q of pts.slice(1)) p = p.lineTo(q);
  p.closePath().style({ fill, color: 'card', width: 1.2 });
};
const slabs = all('.slab'), layers = all('.layer');
for (let i = slabs.length - 1; i >= 0; i--) {
  const c = slabs[i].center.up(8), [side, top] = tone[i];
  face([c.left(A), c.up(B), c.right(A), c.down(B)], `var(--${top})`);
  face([c.left(A), c.down(B), c.down(B + T), c.left(A).down(T)], `var(--${side})`);
  face([c.down(B), c.right(A), c.right(A).down(T), c.down(B + T)], `color-mix(in srgb, var(--${side}) 65%, var(--ink))`);
  draw.moveTo(c.right(A + 8).down(T / 2)).lineTo(pt(layers[i].x - 4, c.y + T / 2)).style({ color: 'line', tail: 'dot' });
}
</script>
</diagram>
```

- **Empty cells as anchors**: `<i class=slab></i>` takes a grid cell and paints nothing;
  the script reads its `.center`. Change the grid and the slabs follow.
- **Back to front**: drawings paint in the order the script makes them, so draw the
  bottom layer first and each slab covers the one below.
- **Shades that follow the theme**: the top face in the pale token (`--lane-a`), one side
  in the strong token, the other in `color-mix(in srgb, var(--woad) 65%, var(--ink))`. In
  the dark theme the tokens change and the mix follows.
- **An icon on each slab**: `icon(c.down(16), 'app service', { size: 28 })` sits on the
  visible front of the top face.
- **Leaders** from each slab's right corner to its card are straight `draw` lines with a
  `dot` tail, level because the slab and the card share a grid row.
- **The figure grows** to hold what the script draws, below and to the right of the page.

## Pitfalls

- A clipped box still takes its whole rectangle in the layout: text placed in the cut-away
  part is invisible but still collides with its neighbours.
- The script's drawings paint above the page. Draw them where no text is, or draw every
  overlapping piece in the script, in order.
- Hex colours stay the same in the dark theme: use the tokens, and `color-mix()` of tokens
  for extra shades.
- A `semicircle`'s border runs along its flat base too. Set the rings on a ruler or a
  baseline that covers it, or leave the border off (`border: 0`).

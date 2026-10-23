# Sequence diagrams

Participants across the top, messages down the page in the order they happen. CSS cannot
give each message a row of its own, so `sequence()` does that placing: it puts each
participant in a column and each message in a row, and adds lifelines, activation bars,
numbers and fragment boxes. The arrows are the drawing script's, one loop for all.

```html
<diagram width=1100 title="Checkout" subtitle="Payment with 3-D Secure">
<div class=seq id=seq>
  <div class=node id=browser data-who><icon name=browser></icon>Shopper<small>browser</small></div>
  <div class=node id=shop data-who><icon name="app service"></icon>Web shop<small>App Service</small></div>
  <div class="node external" id=psp data-who><icon name=cloud></icon>Payment provider</div>
  <div class="node external" id=bank data-who><icon name=shield></icon>Bank</div>
  <div class="group external" data-who-group="psp bank"><h4>Third parties</h4></div>

  <p class=msg data-from=browser data-to=shop>POST checkout</p>
  <p class=msg data-from=shop data-to=psp>create payment</p>
  <p class="msg reply" data-from=psp data-to=shop>client secret</p>
  <div class=frag data-kind=alt data-guard="3-D Secure required">
    <p class="msg reply" data-from=psp data-to=browser>redirect to bank</p>
    <p class=msg data-from=browser data-to=bank>shopper approves</p>
    <div class=else data-guard="no 3-D Secure"></div>
    <p class="msg reply" data-from=psp data-to=browser>payment completes</p>
  </div>
  <p class="msg async" data-from=psp data-to=shop>payment succeeded</p>
  <p class=msg data-from=shop data-to=shop>mark order paid</p>
</div>
<script type="graphally" before>sequence('#seq')</script>
<script type="graphally">
for (const m of all('.msg')) {
  const d = m.el.dataset, a = el(d.from).center.x, b = el(d.to).center.x, y = m.bottom.y - 6;
  const o = { dashed: m.el.matches('.reply'), head: m.el.matches('.async') ? 'open' : 'arrow' };
  if (d.from === d.to) draw.moveTo(pt(a + 6, y - 16)).lineTo(pt(a + 40, y - 16)).lineTo(pt(a + 40, y)).lineTo(pt(a + 6, y)).style(o);
  else arrow(pt(a + (b > a ? 6 : -6), y), pt(b + (b > a ? -6 : 6), y), o);
}
</script>
</diagram>
```

## How to

- **Participants** are direct children of the container with `data-who`, in the order of
  their columns. Any block works; `node` gives the usual card.
- **Messages**: `<p class=msg data-from=a data-to=b>text</p>`. Add `reply` for a dashed
  return, `async` for an open arrowhead. A message to oneself loops on the right.
- **Fragments**: `<div class=frag data-kind=alt data-guard="condition">` around messages;
  `<div class=else data-guard="other">` divides its parts. Kinds: `alt`, `opt`, `loop`,
  `par`, `break`, `critical`. Fragments nest.
- **A group behind participants** (third parties, one system): `<div class="group external"
  data-who-group="psp bank"><h4>Third parties</h4></div>`.
- **Activation bars** run from a call to the reply that answers it (or one row). Numbers
  come first in each message; `sequence('#seq', { number: false, activations: false })`
  leaves them out.
- **The arrows** are the loop in the example, copied as it is.

## Pitfalls

- A message to oneself on the last participant runs past the right edge: give the
  container room (`class="seq pr-40"`).
- Long message labels widen nothing; keep them to a few words.

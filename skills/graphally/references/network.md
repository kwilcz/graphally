# Networks

VNets hold subnets, subnets hold what is deployed into them, and peering, VPN and private
links join them. Draw each VNet as a `group vnet`, each subnet as a `group subnet` inside
it, and place the VNets with a grid map.

```html
<diagram width=1500 title="Retail network" subtitle="Hub and spoke, West Europe">
<style>
  .map { grid-template-areas: "inet key onprem" "spoke hub ." "paas paas paas"; }
  .figure { width: 150px; }
</style>
<div class="map grid justify-between items-start gap-x-24 gap-y-10">
  <div class="group plain [grid-area:inet]"><h4>Internet</h4>
    <div class="figure external" id=shopper><icon name=browser></icon>Customers<small>web browser</small></div>
  </div>
  <div class="key flex-col items-start gap-[10px] [grid-area:key]"><h4>Key</h4>
    <span><i class="swatch border-0 h-2" id=k1></i>traffic</span>
    <span><i class="swatch box"></i>outside our control</span>
  </div>
  <div class="group external justify-self-end [grid-area:onprem]"><h4>On-premises <small>10.200.0.0/16</small></h4>
    <div class="figure external" id=dc><icon name=building></icon>Datacenter<small>corporate network</small></div>
  </div>
  <div class="group vnet gap-[60px] [grid-area:spoke]" id=spoke><h4><icon name=vnet></icon>vnet-shop <small>10.10.0.0/16</small></h4>
    <div class="group subnet"><h4>snet-agw <small>10.10.0.0/24</small></h4>
      <div class=figure id=agw><icon name="app gateway"></icon>Application Gateway<small>WAF v2</small></div></div>
    <div class="group subnet"><h4>snet-pe <small>10.10.2.0/24</small></h4>
      <div class=figure id=pe><icon name="private endpoint"></icon>Private endpoint<small>Azure SQL</small></div></div>
  </div>
  <div class="group vnet [grid-area:hub]" id=hub><h4><icon name=vnet></icon>vnet-hub <small>10.0.0.0/16</small></h4>
    <div class="group subnet"><h4>AzureFirewallSubnet <small>10.0.1.0/26</small></h4>
      <div class="figure accent" id=fw><icon name=firewall></icon>Azure Firewall<small>all egress</small></div></div>
    <div class="group subnet"><h4>GatewaySubnet <small>10.0.0.0/27</small></h4>
      <div class=figure id=gw><icon name="vpn gateway"></icon>VPN gateway<small>site-to-site</small></div></div>
  </div>
  <div class="band justify-start gap-x-40 [grid-area:paas]"><h4>Azure PaaS</h4>
    <div class=figure id=sql><icon name=sql></icon>Azure SQL<small>orders</small></div>
  </div>
</div>
<script type="application/json">
[
  ["shopper", "agw", "HTTPS"],
  ["dc", "gw", "VPN"],
  ["gw", "fw", "UDR 0.0.0.0/0"],
  { "from": "spoke", "to": "hub", "label": "peering", "both": true },
  ["pe", "sql", "private link"]
]
</script>
<script type="graphally">arrow(el('k1').left, el('k1').right);</script>
</diagram>
```

## How to

- **Place the VNets with a map.** `grid-template-areas` in a `<style>` names the cells; each
  group takes one with `[grid-area:hub]`. Put the internet and on-premises on top, the hub
  in the middle, spokes beside it, shared PaaS in a `band` at the bottom.
- **Address ranges** go in the group title's `<small>`: `<h4>snet-pe <small>10.10.2.0/24</small></h4>`.
- **A hub with several subnets** is a grid inside the VNet group:
  `class="group vnet grid grid-cols-2 gap-x-36 gap-y-11"` with `class=col-span-full` on its `<h4>`.
- **Peering** is a connection between the two VNet groups (their ids), `"both": true`.
- **Items are figures**: an icon over its name and a `<small>` line, with no frame; the
  subnet around it is the frame. Give them one width (`.figure { width: 150px; }`), so a
  line between two stacked items runs straight.
- **A spoke lower than the hub**: `self-end` on its group aligns it to the bottom of its row;
  never a margin of a guessed size.
- **Shared services** used by many groups (DNS, Key Vault, monitoring) are drawn once, in
  the band, and marked with a `badge` in each user's title instead of a line from each:
  `<h4>vnet-hub<span class=badges><span class=badge><icon name="private dns"></icon></span></span></h4>`.
  Add the badge to the key.
- **Outside your control** (internet users, on-premises, third parties): `figure external`
  (muted) in a `group external` (dashed).

## Pitfalls

- A subnet title in the way of a vertical line makes it jog: widen the items so the line
  runs clear of the title, or move the title.
- Do not draw a line from every VNet to a shared service; badge it.

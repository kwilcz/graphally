# Network diagrams

VNets and subnets are nested groups. Put the address range in `sub`, the VNet icon on the
VNet, and an NSG icon on subnets that have one.

```html
<diagram title="Hub and spoke" subtitle="West Europe">
<layout>
users  .    spoke1
onprem hub  spoke1
.      hub  spoke2
</layout>
<node id=users icon=users style=icon external>Internet users</node>
<group id=onprem label="On-premises" icon=building style=dashed>
  <node id=vpndev icon=firewall>VPN device</node>
</group>
<group id=hub label="vnet-hub" sub="10.0.0.0/16" icon=vnet style=vnet>
  <group id=gw label="GatewaySubnet" sub="10.0.0.0/27" style=subnet>
    <node id=vpngw icon="vpn gateway">VPN Gateway</node>
  </group>
  <group id=fwsub label="AzureFirewallSubnet" sub="10.0.1.0/26" style=subnet>
    <node id=fw icon=firewall>Azure Firewall</node>
  </group>
</group>
<group id=spoke1 label="vnet-app" sub="10.1.0.0/16" icon=vnet style=vnet>
  <layout>
  web app
  pe  pe
  </layout>
  <group id=web label="snet-web" sub="10.1.0.0/24" icon=nsg style=subnet>
    <node id=agw icon="app gateway">App Gateway | WAF v2</node>
  </group>
  <group id=app label="snet-app" sub="10.1.1.0/24" icon=nsg style=subnet>
    <node id=aks icon=aks>AKS</node>
  </group>
  <group id=pe label="snet-pe" sub="10.1.2.0/24" style=subnet layout=row>
    <node id=pesql icon="private endpoint">pe-sql</node>
  </group>
</group>
<group id=spoke2 label="vnet-data" sub="10.2.0.0/16" icon=vnet style=vnet>
  <group id=db label="snet-db" sub="10.2.0.0/24" style=subnet>
    <node id=sqlmi icon="sql mi">SQL Managed Instance</node>
  </group>
</group>
<links>
users -> agw : HTTPS
vpndev <-> vpngw : IPsec
agw -> aks
aks ~> fw : 0.0.0.0/0 via UDR
aks -> pesql
hub <-> spoke1 : peering
hub <-> spoke2 : peering
</links>
</diagram>
```

- Peering, VPN and ExpressRoute are two-way: `<->`. Peering goes between VNet groups.
- Show forced tunnelling or UDRs as `~>` to the firewall, labelled with the route.
- PaaS services reached through private endpoints sit outside the VNets; link the private
  endpoint node to them with `--` or `->`.
- `style=region` draws a dashed region boundary (for example, two Azure regions).

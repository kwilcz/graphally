# Brief: landing zone network

Network diagram for our landing zone design document. A hub VNet (10.0.0.0/16) in West
Europe holds Azure Firewall, a VPN gateway to the Warsaw office (192.168.0.0/16) and Azure
Bastion. Two spoke VNets peer with the hub: production (10.1.0.0/16) with an app subnet and
a data subnet, and non-production (10.2.0.0/16) with the same layout. User-defined routes
send all egress from the spokes through the firewall. Private DNS zones for Azure SQL and
Key Vault are linked to the hub.

Deliverable: diagram.svg.

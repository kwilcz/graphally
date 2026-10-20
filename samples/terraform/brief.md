# Brief: diagram of a Terraform repository

The platform team wants one diagram of what the Terraform configuration in
[`repo/`](repo) deploys, for onboarding documentation. Readers are engineers new to the
team.

Show:
- the network: VNets, subnets with their address ranges, peering, the VPN gateway;
- where each workload resource runs (which subnet or resource group);
- how the resources connect: ingress, registry pulls, identities and their roles, private
  endpoints, diagnostics;
- the users of the platform: dispatchers reach the logistics API through the Application
  Gateway from the internet, and the head office connects over the site-to-site VPN.
  Terraform does not contain these; add them.

Title: "Fabrikam logistics platform". Subtitle: "Azure, North Europe, production".
Deliverable: diagram.svg.

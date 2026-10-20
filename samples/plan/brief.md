# Brief: migration plan

A Gantt chart for the steering group: the plan for moving Fabrikam's logistics services
to Azure Kubernetes Service in the first half of 2026. Show where we are today
(2 March 2026).

Workstreams and tasks:

- Network: the hub VNet and site-to-site VPN, 5 to 30 January (done); then the spoke VNets
  and peering, two weeks.
- Platform: the AKS cluster and ingress, three weeks after the spokes (this is the critical
  task); PostgreSQL and Service Bus, four weeks from 9 February; monitoring and alerts, two
  weeks after the cluster.
- Applications: a pilot with the tracking service, three weeks once both the cluster and
  the data services are ready; then moving the remaining services, five weeks; go-live on
  25 May.
- Security review: an external penetration test, one week, in the week before go-live,
  done by an outside firm.

Show the dependencies. Deliverable: diagram.svg.

# Brief: who does what in the move to AKS

A one-page figure for Fabrikam's steering group: the four phases of moving the logistics
services to Azure Kubernetes Service, and what each team does in each phase.

- Phases, as arrow-shaped bars: Plan, Build the platform, Migrate in waves, Operate.
  Milestones between them: M1 landing zone approved, M2 platform ready, M3 last wave live.
- Teams, one band each, a card per phase:
  - Platform team: size the clusters and the network; build AKS, ingress and GitOps; run
    the clusters for each wave; patch, scale and keep costs down.
  - Application teams: pick the services and their order; containerise the tracking
    service as the pilot; move the remaining services wave by wave; own their services'
    alerts and releases.
  - Security: agree the controls; review the platform before M2; test each wave before
    it goes live; review access every quarter.
- Hand-offs: the platform's build delivers "cluster and pipelines" to the application
  teams' first wave; Security's platform review gates M2; each wave goes through
  Security's tests ("test and fix") and repeats until the services are moved.

Deliverable: diagram.svg.

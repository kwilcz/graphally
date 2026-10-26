# Brief: the solution, layer by layer

For the solution design of the Northwind claims platform: the platform on Azure as
layers, from the shared landing zone up to what customers use, with the services each
layer is built from. One look should tell an executive what is being built; the services
are there for the architects.

- Experience: the mobile app, the customer portal, Front Door, customer sign-in.
- Applications: the claims service (App Service), the rules engine (Functions), letters
  and emails (Logic Apps).
- Integration: API Management, Service Bus and Event Grid, towards the policy and payment
  systems.
- Data: the claims database (Azure SQL), the document store (Blob Storage), migration
  pipelines (Data Factory).
- Landing zone: the hub-and-spoke network, the firewall, Key Vault, policies.
- Across every layer, from day one: monitoring around the clock, central logs, threat
  protection, backup and recovery, a service desk.

Deliverable: diagram.svg.

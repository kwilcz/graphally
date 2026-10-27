# Brief: order platform on Azure

For our solution design document: the production architecture of our order platform on
Azure. Customers use a web app and a mobile app through Azure Front Door with WAF. The web
front end runs on App Service; the APIs run on AKS in a spoke VNet, behind an internal
Application Gateway. Orders go to Azure SQL (zone-redundant) and product data to Cosmos DB;
both are reached over private endpoints. The API publishes order events to Service Bus;
Azure Functions consume them to send emails through SendGrid and to sync orders to our on-
premises SAP ERP over ExpressRoute, through the hub VNet's Azure Firewall. Secrets are in
Key Vault, identities in Entra ID, and monitoring in Application Insights and Log Analytics.
Make the architecture diagram.

Deliverable: diagram.svg.

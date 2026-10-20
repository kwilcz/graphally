# Brief: Fabrikam Retail network topology

Draw the Azure network of Fabrikam Retail for the platform team. They need to see address
spaces, where traffic enters and leaves, and how the spokes reach shared services.

- **On-premises**: the Fabrikam datacenter (10.200.0.0/16) connects to Azure over
  **ExpressRoute**.
- **Hub VNet** `vnet-hub-weu` (10.0.0.0/16):
  - `GatewaySubnet` (10.0.0.0/27) with the **ExpressRoute gateway**.
  - `AzureFirewallSubnet` (10.0.1.0/26) with **Azure Firewall**. All spoke traffic to the
    internet and to on-premises goes through it (UDR 0.0.0.0/0 → firewall).
  - `AzureBastionSubnet` (10.0.2.0/26) with **Bastion**.
  - `snet-dns` (10.0.3.0/28) with the **DNS Private Resolver**.
- **Spoke** `vnet-ecommerce-prod` (10.10.0.0/16):
  - `snet-agw` (10.10.0.0/24) with **Application Gateway WAF v2**, which receives customer
    traffic from the internet.
  - `snet-app` (10.10.1.0/24): the **App Service** web app's VNet integration.
  - `snet-pe` (10.10.2.0/24): **private endpoints** for **Azure SQL** and **Storage**.
- **Spoke** `vnet-analytics-prod` (10.20.0.0/16):
  - `snet-dbw-public` and `snet-dbw-private` (10.20.0.0/24, 10.20.1.0/24) for
    **Azure Databricks**.
  - `snet-pe` (10.20.2.0/24) with a **private endpoint** to **Data Lake Storage**.
- Both spokes are **peered** with the hub. **Private DNS zones** are linked to the hub.
- Customers reach the shop over HTTPS through the Application Gateway.

The deliverable is one SVG.

# Brief: Fabrikam management group hierarchy

Draw Fabrikam's Azure management group and subscription hierarchy for the governance board.

- **Tenant root group** contains the **Fabrikam** management group.
- **Fabrikam** contains four management groups: **Platform**, **Landing zones**,
  **Sandbox**, and **Decommissioned**.
- **Platform** contains **Management**, **Connectivity** and **Identity**, each holding one
  subscription of the same name.
- **Landing zones** contains **Corp** (subscriptions: Payroll, HR portal, Finance
  reporting) and **Online** (subscriptions: E-commerce, Loyalty app).
- **Sandbox** holds two subscriptions: Sandbox Team A, Sandbox Team B.
- **Decommissioned** holds no subscriptions.

Show which level each item belongs to (root, top-level, management groups, subscriptions).
Use Azure icons. The deliverable is one SVG.

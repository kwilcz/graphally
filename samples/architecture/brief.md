# Brief: Contoso Field Service on Azure

Draw the production architecture of Contoso Field Service, a SaaS product that schedules
field technicians. The audience is engineers joining the team. The diagram should let them
see how a request travels, where events flow, and what is outside our control.

Components:

- **Users.** Dispatchers use the web app in a browser. Technicians use a mobile app. Both
  sign in with **Microsoft Entra ID** (OpenID Connect), with single sign-on from their own
  company's tenant. The API validates Entra ID tokens on every call.
- **Edge.** **Azure Front Door** with WAF receives all traffic and routes it to the web
  front end and the API.
- **Web front end.** An **App Service** web app with two **deployment slots**, `staging`
  and `production`. Releases deploy to staging and then swap slots.
- **API and engine.** An **Azure Container Apps** environment runs two containers:
  `jobs-api` (the public API) and `scheduling-engine` (internal). Images come from
  **Azure Container Registry**.
- **Messaging.** A **Service Bus** namespace with a `job-events` topic. `jobs-api`
  publishes events to it.
- **Functions.** Two **Azure Functions** subscribe to `job-events`: `notify` sends SMS and
  push messages through **Twilio** (external), and `billing-sync` sends completed jobs to
  the customer's **SAP ERP** (external).
- **Routing.** `scheduling-engine` calls the **Google Maps Routes API** (external) to plan
  technician routes.
- **Data.** **Azure SQL Database** holds jobs, **Cosmos DB** holds technician locations,
  and a **Storage account** holds job photos.
- **Platform.** **Key Vault** holds secrets; the apps reach it with managed identities.
  **Application Insights** and **Log Analytics** collect telemetry from every app.

Requirements:

- Group components so a reader sees the tiers or resource groups at a glance.
- Label arrows with what flows.
- Distinguish asynchronous messaging from synchronous calls.
- Make external systems visibly external.
- Use Azure icons.
- The deliverable is a single SVG file.

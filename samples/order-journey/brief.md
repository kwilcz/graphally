# Brief: make the orders diagram self-explanatory

Here's our orders diagram. Business people don't get it. Make it self-explanatory.

The diagram given was a topology: a shopper's browser, Azure Front Door with WAF, the Orders
API on App Service, the Orders DB on Azure SQL ("writes"), a Service Bus orders topic
("order placed", dashed) and a worker on Azure Functions ("events", dashed).

Deliverable: diagram.svg.

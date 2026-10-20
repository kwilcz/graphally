# Brief: checkout payment sequence

A sequence diagram for the payments team's runbook: what happens when a shopper pays.

Participants: the shopper's browser; the web shop (App Service); the Payments API
(Container App); Stripe (external); the shopper's bank 3-D Secure page (external); the
orders database (Azure SQL); Service Bus.

Flow: the browser posts the checkout to the web shop, which calls the Payments API to
create a payment. The Payments API creates a PaymentIntent at Stripe and gets back a client
secret, which goes back to the web shop and the browser. The browser confirms the payment
with Stripe directly. If the bank requires 3-D Secure, Stripe redirects the browser to the
bank's page, the shopper approves, and the bank returns the browser to the shop; otherwise
the payment completes immediately. Stripe later calls the Payments API's webhook
asynchronously with payment_intent.succeeded; the Payments API marks the order paid in the
database, publishes an "order paid" event to Service Bus, and replies 200 to Stripe. While
waiting, the browser polls the web shop for the order status every 2 seconds until it is
paid, then shows the confirmation page.

Number the steps. Deliverable: diagram.svg.

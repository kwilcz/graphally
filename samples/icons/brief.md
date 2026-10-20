# Brief: how Microsoft Entra application proxy works

An icon-style diagram for the help-desk documentation, in the manner of Microsoft's own
docs: large service icons with their names under them, few words, no boxes around
services.

Remote users on laptops sign in to Microsoft Entra ID first (pre-authentication). Their
HTTPS requests then go to the application proxy service in Azure. Inside the on-premises
network, an application proxy connector keeps an outbound-only connection to that
service, so no inbound firewall ports are open. The connector forwards each request over
HTTP to the internal web applications and uses Kerberos with Active Directory for single
sign-on. Draw the on-premises network as a boundary around the connector, the web apps
and Active Directory.

Title: "Microsoft Entra application proxy". Subtitle: "Remote access to on-premises web
apps without opening inbound ports". Deliverable: diagram.svg.

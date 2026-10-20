# Brief: release pipeline

A flowchart (no swimlanes) of how the orders service is released, for the team's
on-call guide.

A merge to main starts the pipeline. It builds the container image and runs the unit
tests; if they fail, the pipeline stops and notifies the author. Otherwise it pushes the
image to the registry and deploys it to the staging slot of the App Service. Smoke tests
run against staging: if they fail, staging is rolled back to the previous image and the
on-call engineer is paged. If they pass, the pipeline waits for a manual approval (at most
24 hours; without approval it expires and stops), then swaps the staging and production
slots and watches the error rate for 15 minutes. If the error rate rises above 2%, it
swaps back and pages on-call; otherwise the release is done.

Deliverable: diagram.svg.

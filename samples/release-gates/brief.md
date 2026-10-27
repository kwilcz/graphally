# Brief: how a change reaches production

For the onboarding wiki: how a code change reaches production here. A pull request needs two
reviewers, CI runs the tests (about 20 minutes), the change sits in staging for a day, then
a canary release to 5% of users for two hours, then everyone. Any failed step sends it back
to the developer. Make a figure new engineers will understand.

Deliverable: diagram.svg.

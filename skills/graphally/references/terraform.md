# Terraform repositories

Do not read the `.tf` files to draw them. Generate a draft from the code, render it, look
at it, then edit only what tells the story.

```sh
node ${CLAUDE_SKILL_DIR}/scripts/tf2graphally.mjs <terraform dir> --out diagram.html --title "Orders platform"
node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs render diagram.html --png
```

The first command reads the root module and every local module (`source = "./…"`) and
prints what it folded. The draft is an ordinary diagram file:

- resource groups are `group` boxes; VNets (`group vnet`) hold subnets (`group subnet`); a
  resource sits in the subnet it is deployed into (private endpoints, firewalls, bastions);
  an App Service plan holds its apps;
- every resource is a `node` with its icon, its name and its kind in `<small>`;
- references become connections in the JSON list, named by what they mean: `secrets`,
  `telemetry`, `SQL`, `private link`, `peering`, `UDR 0.0.0.0/0`, `VNet integration`; a role
  assignment is labelled with the role; diagnostic settings are dashed;
- databases, containers, queues and secrets are listed on their parent's `<small>` line;
  associations and public IPs fold into what they belong to; `count` and `for_each` show ×N;
- remote modules (registry sources) appear as one dashed node each.

Edit the draft, then render again. Usual edits:

| Want | Do |
|---|---|
| a clearer story | set `title`, `subtitle`; rename a node's text |
| less noise | delete a node and its connections |
| what Terraform cannot know | add users, external APIs and the request path as nodes and connections |
| a better arrangement | change the classes of the containers: a `grid grid-cols-2` for subnets, a map of areas for the groups (see `network.md`) |
| one diagram per area | keep one resource group's box and delete the others |

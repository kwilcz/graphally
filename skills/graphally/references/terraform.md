# Terraform repositories

Do not read the `.tf` files to draw them. Generate a draft from the code, look at it, then
edit only what tells the story.

```sh
node ${CLAUDE_SKILL_DIR}/scripts/tf2graphally.mjs <terraform dir> --out diagram.html --title "Orders platform"
node ${CLAUDE_SKILL_DIR}/scripts/graphally.mjs render diagram.html --png
```

The first command reads the root module and every local module (`source = "./…"`) and
prints what it folded. The draft is an ordinary graphally diagram:

- resource groups are boxes; VNets hold subnets; a resource sits in the subnet it is
  deployed into (private endpoints, firewalls, bastions); an App Service plan holds its apps;
- references become links named by what they mean: `secrets`, `telemetry`, `SQL`,
  `private link`, `peering`, `UDR 0.0.0.0/0`, `VNet integration`; a role assignment is a
  link labelled with the role; diagnostic settings are dashed links;
- databases, containers, queues and secrets are listed on their parent's second line;
  associations and public IPs fold into what they belong to; `count` shows ×N.

Edit `diagram.html`, then render again. Usual edits:

| Want | Do |
|---|---|
| a clearer story | set `title`, `subtitle`; rename a node (text before `\|`) |
| less noise | delete a node line and its links |
| what Terraform cannot know | add users, external APIs, the request path as nodes and links |
| a better arrangement | edit the `<layout>` map of the resource groups |
| one diagram per area | keep one resource group's box and delete the others |

Remote modules (registry sources) appear as one dashed node each.

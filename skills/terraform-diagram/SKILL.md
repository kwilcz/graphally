---
name: terraform-diagram
description: Draws a diagram of a Terraform repository with graphally - drafts the resources, modules and their connections from the code, then designs the figure around its point. Use to visualise Terraform or infrastructure-as-code; not for writing Terraform.
---

# Diagram of a Terraform repository

graphally draws this; this skill routes to it.

1. Load the graphally skill and follow its workflow. Where skills are not loaded by name, read
   `../graphally/SKILL.md` beside this folder; its scripts are in `../graphally/scripts/`.
2. Before designing, read graphally's `references/terraform.md`: the draft comes from the code,
   through graphally's `scripts/tf2graphally.mjs`.
3. Draw what the user typed with the command or described in the conversation. When the Terraform
   root folder is not clear, ask for it.

If graphally is not installed, say so and give the install steps at
https://github.com/kwilcz/graphally#install-for-your-agent; do not draw it another way.

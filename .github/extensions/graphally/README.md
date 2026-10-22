# graphally canvas for the GitHub Copilot app

A canvas extension that shows a graphally diagram live in the Copilot app's side panel and
lets you change it with the mouse. The diagram file stays the source: every gesture is
written into it, and every change to it, yours or the agent's, shows up in the panel.

| On the canvas | Written into the file |
|---|---|
| drag a box | `nudge="dx,dy"` on that element |
| Alt-drag from one box to another | a connection in the diagram's JSON connections |
| drag a line | a `via` point on that connection |
| double-click a line | its `label` |
| select a line, Delete | the connection removed |
| select a box, arrow keys | `nudge` by 1px (10px with Shift) |

Each render is saved next to the file as `<name>.svg`, as `graphally render` would save it.
Lines keep their sides from one render to the next, so moving one box leaves the others'
lines alone. Boxes, text and styles are edited in the file itself (or by the agent); the
panel follows.

## Install

1. Install the graphally skill (see the repository README). The canvas finds it in
   `skills/graphally`, `.github/skills/graphally` or `.claude/skills/graphally` of the
   repository, in the same folders under your home directory, or wherever
   `GRAPHALLY_SKILL_DIR` points.
2. Copy this folder to `.github/extensions/graphally/` in your repository (for that
   repository) or to `~/.copilot/extensions/graphally/` (for every repository).
3. In the Copilot app, ask for it: "open docs/orders.html in the graphally canvas".

The extension needs Node.js 20.19 or later (the Copilot SDK's requirement); the app
provides the SDK.

## What the agent can do

- `get_diagram`: a picture of the canvas, the problems of the last render, the boxes, the
  connections with their keys, and what you have selected ("connect the selected box to
  the database").
- `apply_edits`: move elements and add, change or remove connections; returns the new
  render's problems. Anything else it changes by editing the file.

Connections the canvas edits are the diagram's JSON connections
(`<script type="application/json">`). Lines drawn by `connect()` in a script are shown, but
change in the script.

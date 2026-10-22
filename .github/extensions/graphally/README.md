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

1. Install the graphally skill (see the repository README). The canvas looks for it in
   `skills/graphally`, `.github/skills/graphally`, `.copilot/skills/graphally`,
   `.claude/skills/graphally` or `.agents/skills/graphally` of the session's folder or any
   folder above it, then in `~/.copilot/skills/graphally`, `~/.claude/skills/graphally` and
   `~/.agents/skills/graphally`, or wherever `GRAPHALLY_SKILL_DIR` points.
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

## When the canvas does not load

The app reports "Failed to start or stopped unexpectedly" when the extension's process
exits, or does not join the session in time. To see why:

1. Click **Details** on the notice, or ask the agent in the app to run `extensions_manage`
   with `operation: "inspect"` and `name: "graphally"`: it shows the extension's status and
   its last error.
2. After a fix, ask it to run `extensions_reload`, or restart the app.

The usual causes, most likely first:

| Cause | What you see | Fix |
|---|---|---|
| The skill is not found | "graphally skill not found" in the timeline; opening the canvas fails with `graphally_unavailable` | install the skill in one of the folders above, or set `GRAPHALLY_SKILL_DIR` |
| Files missing from the copy | the import of `./server.mjs` fails | copy the whole folder: `extension.mjs`, `server.mjs`, `canvas.html`, `canvas.js` |
| The app has no canvas API | "no canvas API (createCanvas)" in the timeline | update the Copilot app |
| Node.js older than 20.19 | a warning in the timeline, or the SDK fails to load | update Node.js |
| A fault in the app | GitHub's own canvases fail the same way | see [github/app#4119](https://github.com/github/app/issues/4119) and [github/copilot-cli#4966](https://github.com/github/copilot-cli/issues/4966) (on Windows, from 1.0.88, the session join can stall and the app stops the extension after 30 seconds) |

The extension joins the session before it looks for the skill and keeps running when
something is missing, so a missing skill, an app without canvases and an old Node.js show
up as messages, not as a failed start.

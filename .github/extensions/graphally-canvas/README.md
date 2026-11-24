# graphally canvas

A canvas for the GitHub Copilot app: a graphally diagram (`.html`) in the app's side panel, where you and the agent edit the same file.

- **Move a box:** drag it. Letting go writes the move as the box's `nudge`.
- **Connect two boxes:** select the first, type a label if you want one, press **Connect to…**, and click the second.
- **Change a line:** click it to select it, then set its label, the sides it leaves and enters by (**Out**, **In**), or delete it (**Delete line** or the Delete key).
- **Agent edits:** when the agent edits the file, the canvas follows, within a quarter of a second.

Every change is a text patch of the diagram's source, made by the skill's own edit module (`skills/graphally/scripts/lib/edits.mjs`). The rest of the file stays as written, and every render afterwards keeps the change.

## Opening it

In a Copilot app session in this repository, ask for the graphally canvas on a diagram file, for example: "Open the graphally canvas on `samples/flowchart/diagram.html`". The canvas takes `filePath`, relative to the workspace; the default is `diagram.html`.

## What the agent can do

| Action | What it does |
|---|---|
| `get_diagram` | Reads the file's path, its HTML source, its connections (each with the key that names it) and your selection. |
| `apply_edits` | Edits the file the way `graphally edit` does: `move` or `nudge` a box; `connect`, `line` (change options) or `unline` a line. It reports the edits that failed, and why. |
| `get_selection` | Reads the boxes and lines you selected. |
| `select` | Selects boxes and lines for you, to point at them. |

## How it is built

- **`extension.mjs`:** registers the canvas and its actions with the app (`@microsoft/copilot-sdk/extension`, which the app provides).
- **`instances.mjs`, `session.mjs` and `server.mjs`:** know nothing of the app. Each open canvas is a session on one file, served on `127.0.0.1` with the page, the engine and a stream of the file's changes.
- **`app/`:** the page. It draws the diagram with the skill's viewer bundle (`skills/graphally/viewer/graphally.min.js`), so it lays out and routes exactly as a render does.

Lines move once you let go of a box, when the canvas redraws the diagram from the edited file.

Two kinds of line can be selected but not edited from the toolbar: a line written as part of a list (`"from": ["a", "b"]`), and a line drawn by a script. The canvas says so; edit those in the source.

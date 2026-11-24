# graphally canvas

A canvas for the GitHub Copilot app: a graphally diagram (`.html`) in the app's side panel, where you and the agent edit the same file. It is a proof of concept, built to feel how editing a diagram by hand could work.

The canvas edits the diagram the way its author wrote it. A diagram laid out in grid cells changes cells; a column of boxes changes order; a box placed freehand changes its nudge. Each change is a small text patch of the source, made by the skill's own edit module (`skills/graphally/scripts/lib/edits.mjs`), so the rest of the file stays as written and the agent can keep editing it.

## Trying it

Outside the Copilot app, serve the canvas for one file and open the address it prints:

```sh
node .github/extensions/graphally-canvas/preview.mjs samples/architecture/diagram.html
```

Edits go to the file, so try it on a copy. In a Copilot app session in this repository, ask for the graphally canvas on a diagram file instead, for example: "Open the graphally canvas on `samples/flowchart/diagram.html`".

## What your hands do, and what each writes

| You | The source |
|---|---|
| Drag a box into another column of a grid | Its column class changes: `col-[3]` becomes `col-[5]`. |
| Drag a box along a column or row of boxes, or into another group like it | The element moves in the source, before the sibling the marker shows. |
| Alt-drag a box | Its `nudge` changes. |
| Double-click text, or press Enter | That text run changes; the markup around it stays. |
| Change Id, Classes or a variant in the properties panel | That attribute changes. |
| Duplicate (Ctrl+D) | A copy follows the element; its ids get `-2`, `-3`. |
| Delete | The element goes, with the lines to the ids inside it. |
| Connect to…, then click a box | A line joins the two. |
| Select a line, then set its label or sides | That line's options change. |

A click selects the box that moves as a whole; a second click on the selection goes one level in. Esc goes back out. The layers panel lists every element as the source nests it, including chips and rows that have no id. Undo and Redo step through every change to the file while the canvas is open: yours, the agent's, and those from other programs.

## What the agent can do

| Action | What it does |
|---|---|
| `get_diagram` | Reads the file's path and source, its connections (each with the key that names it), its elements as layers (each with its path) and your selection. |
| `apply_edits` | Edits the file: `text`, `attr`, `cell`, `place`, `remove`, `duplicate` and `insert` on elements, named by id or by path; `move` and `nudge` on boxes; `connect`, `line` and `unline` on lines. It reports the edits that failed, and why. |
| `get_selection` | Reads the elements and lines you selected. |
| `select` | Selects elements and lines for you, to point at them. |

## How it is built

- **Paths:** an element's path is its place among the elements of `<diagram>`, `0.2.1`. The edit module reads them from the source text (`edits/tree.mjs`), and the page stamps the same paths onto the elements it renders (`data-src`). One number names one element on both sides.
- **The layout model:** when a diagram carries `data-edit`, the viewer also returns each element's box and what places it: grid tracks and lines, flex direction, flow (`engine/page/layout-model.js`). Without `data-edit`, a render is unchanged.
- **The drop:** `app/drop.js` asks the model what holds the pointer. In a grid with explicit columns, it is a cell; in a flex or flow container, it is a place between two siblings.
- **`extension.mjs`:** registers the canvas and its actions with the app (`@microsoft/copilot-sdk/extension`, which the app provides).
- **`instances.mjs`, `session.mjs` and `server.mjs`:** know nothing of the app. Each open canvas is a session on one file, served on `127.0.0.1` with the page, the viewer and a stream of the file's changes.
- **`app/`:** the page. It draws with the skill's viewer bundle (`skills/graphally/viewer/graphally.min.js`), so it lays out and routes exactly as a render does.

## Limits of the proof of concept

- Lines move when you let go, once the canvas redraws from the edited file; they do not follow the drag.
- Grid areas (`[grid-area:…]`) take no drops yet; Alt-drag nudges a box there.
- A line written as part of a list (`"from": ["a", "b"]`) or drawn by a script can be selected but not edited from the panel. The canvas says so; edit those in the source.

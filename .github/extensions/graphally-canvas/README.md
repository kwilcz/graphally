# graphally canvas

A canvas for the GitHub Copilot app: a graphally diagram (`.html`) in the app's side panel, where you and the agent edit the same file. It is a proof of concept, built to feel how editing a diagram by hand could work.

The canvas edits the diagram the way its author wrote it. A box laid out in a grid cell moves to another cell; a box in a column of boxes moves along it; a rule in the diagram's `<style>` changes where it is written. Each change is a small text patch of the source, made by the skill's own edit module (`skills/graphally/scripts/lib/edits.mjs`), so the rest of the file stays as written and the agent can keep editing it.

## Trying it

Outside the Copilot app, serve the canvas for one file and open the address it prints:

```sh
node .github/extensions/graphally-canvas/preview.mjs samples/architecture/diagram.html
```

Edits go to the file, so try it on a copy. In a Copilot app session in this repository, ask for the graphally canvas on a diagram file instead, for example: "Open the graphally canvas on `samples/flowchart/diagram.html`".

## Moving things

| You | The source |
|---|---|
| Drag a box to another cell of its grid, or a lane's grid | Its column and row change (`col-[3]` becomes `col-[5]`); in another lane it moves there too. A box already in that cell trades places with it. |
| Drag a region of a map to another area | Its area changes (`[grid-area:edge]` becomes `[grid-area:msg]`); the region there takes its old area. |
| Drag a span handle (the squares on a grid box's right and bottom edges) | Its span changes (`col-[3/span_2]`). |
| Drag a box along a column or row of boxes, or into a group like it | The element moves in the source, before the sibling the marker shows. |
| Ctrl-drag | Any container under the pointer takes the box. |
| Alt-drag | Its `nudge` changes. |
| Drag a layer onto another in the layers panel | It moves before it (top quarter), after it (bottom quarter), or into it. |
| Alt+↑ / Alt+↓, Alt+→ / Alt+← | It moves before or after its sibling; into the sibling before it, or out of its parent. |
| Group (Ctrl+G), Ungroup (Ctrl+Shift+G) | It goes into a new `<div class="group">`, taking the classes that place it; ungrouping puts the group's children in its place. |

Each grid placement is written where the source places the element. The styles panel's cascade says which declaration wins: a utility class is swapped, the style attribute or a rule that styles this element alone is changed in place, and a rule several elements share is left alone while the element gets a class of its own (or, against a stronger rule, a style attribute).

## Styling things

The Styles section lists what styles the selection, as the browser's cascade orders it: the element's style attribute, the utility classes it carries (with the CSS each one stands for), every rule of the diagram's `<style>` that matches it (with how many elements the rule styles), and graphally's defaults for its building blocks. A declaration another one beats is struck through.

- **Change a value or a property name:** edit it in place; Enter writes it to the rule it is in.
- **Add a declaration:** type into the empty row at the end of the style attribute or of a rule.
- **Remove one:** empty it, or press × beside it.
- **Change a utility class:** edit its name.
- **New rule:** adds a rule for the element's id or kind to the diagram's `<style>`.

graphally's defaults are shown, not edited: a rule of the diagram's own overrides them.

## The rest

- **Select:** a click selects the box that moves as a whole; a second click goes one level in; Esc goes back out. The path above the drawing selects any element on the way to the selection, and the layers panel lists every element, including chips and rows that have no id.
- **Text:** double-click it, or press Enter.
- **Properties:** id, classes, text and variants; the element's column, row and span, area or nudge as fields; its lines, each a button that selects it.
- **Lines:** Connect to…, then click a box; select a line to set its label or sides.
- **Duplicate (Ctrl+D), Delete:** a copy gets ids with `-2`; deleting takes the lines to the ids inside.
- **Zoom:** −, +, 100% and Fit, Ctrl+wheel, Shift+1 (fit) and Shift+0 (100%).
- **Undo and Redo:** step through every change to the file while the canvas is open: yours, the agent's, and those from other programs.

## What the agent can do

| Action | What it does |
|---|---|
| `get_diagram` | Reads the file's path and source, its connections (each with the key that names it), its elements as layers (each with its path), its CSS (`styles.rules`, each with its index) and your selection. |
| `apply_edits` | Edits the file: `text`, `attr`, `cell`, `place`, `remove`, `duplicate`, `insert`, `wrap`, `unwrap` and `style` on elements, named by id or by path; `rule` on the diagram's `<style>`; `move` and `nudge` on boxes; `connect`, `line` and `unline` on lines. It reports the edits that failed, and why. |
| `get_selection` | Reads the elements and lines you selected. |
| `select` | Selects elements and lines for you, to point at them. |

## How it is built

- **Paths:** an element's path is its place among the elements of `<diagram>`, `0.2.1`. The edit module reads them from the source text (`edits/tree.mjs`), and the page stamps the same paths onto the elements it renders (`data-src`). One number names one element on both sides.
- **The layout model:** when a diagram carries `data-edit`, the viewer also returns each element's box and what places it: grid tracks, gaps and named areas, flex direction, flow (`engine/page/layout-model.js`). Without `data-edit`, a render is unchanged.
- **CSS:** the edit module reads the diagram's `<style>` rules with where each declaration sits (`edits/css-rules.mjs`) and changes one at a time (`edits/styling.mjs`). The page matches rules to the selection on the source as parsed, and orders them by specificity and source order (`app/cascade.js`, `app/selectors.js`).
- **The drop:** `app/drop.js` asks the model what holds the pointer: a cell or an area of a grid (`app/grid-drop.js`), or a place between two siblings; `app/placement.js` writes the new place where the source keeps it.
- **`extension.mjs`:** registers the canvas and its actions with the app (`@microsoft/copilot-sdk/extension`, which the app provides).
- **`instances.mjs`, `session.mjs`, `server.mjs` and `styles.mjs`:** know nothing of the app. Each open canvas is a session on one file, served on `127.0.0.1` with the page, the viewer and a stream of the file's state.
- **`app/`:** the page. It draws with the skill's viewer bundle (`skills/graphally/viewer/graphally.min.js`), so it lays out and routes exactly as a render does.

## Limits of the proof of concept

- Lines move when you let go, once the canvas redraws from the edited file; they do not follow the drag.
- A rule's selector, and rules that nest rules, are not edited from the panel.
- A line written as part of a list (`"from": ["a", "b"]`) or drawn by a script can be selected but not edited from the panel. The canvas says so; edit those in the source.

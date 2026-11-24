# graphally canvas

A canvas for the GitHub Copilot app: a graphally diagram (`.html`) in the app's side panel, where you and the agent edit the same file.

The canvas edits the diagram the way its author wrote it. A box laid out in a grid cell moves to another cell; a box in a column of boxes moves along it; a rule in the diagram's `<style>` changes where it is written. Each change is a small text patch of the source, made by the skill's own edit module (`skills/graphally/scripts/lib/edits.mjs`), so the rest of the file stays as written and the agent can keep editing it.

## Opening it

In a Copilot app session in this repository, ask for the graphally canvas on a diagram file: "Open the graphally canvas on `samples/flowchart/diagram.html`". The canvas opens `.html` files in the workspace.

Outside the app, serve the canvas for one file and open the address it prints:

```sh
node .github/extensions/graphally-canvas/preview.mjs samples/architecture/diagram.html
```

Edits go to the file, so try it on a copy.

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

While you drag, the canvas shows the diagram as the drop would leave it: the edits are applied without writing the file, and the result is drawn under the pointer, so neighbours make room and lines take their new routes before you let go. A redraw of a sample takes 12 to 62 ms, so the preview keeps up with the pointer. Targets are still found on the drawing as it was, so a target does not slide away as the preview reflows. Alt-drags, span handles and new lines preview the same way.

Each grid placement is written where the source places the element. The cascade says which declaration wins: a utility class is swapped, the style attribute or a rule that styles this element alone is changed in place, and a rule several elements share is left alone while the element gets a class of its own (or, against a stronger rule, a style attribute).

## Adding things and drawing lines

- **+ Box, + Group, + Text:** a new element goes into the selection when it holds boxes (a group, a lane, an empty container), else right after the selection. It is selected with its text ready to type.
- **Drawing a line:** drag the dot off the selected box's top-right corner to another box. Lines join ids, so a box without one gets one from its text (Front Door becomes `front-door`). Connect to… in the properties does the same with a click.
- **A line's label:** double-click the line. Select it to set its sides, or delete it. A line written with others (`"from": ["a", "b"]`) changes with them, as the panel says; **Split out** gives it an entry of its own, and Delete removes it alone.

## Styling things

The Styles section lists what styles the selection, as the browser's cascade orders it: the element's style attribute, the utility classes it carries (with the CSS each one stands for), every rule of the diagram's `<style>` that matches it (with how many elements the rule styles), and graphally's defaults for its building blocks. A declaration another one beats is struck through.

- **Change a value or a property name:** edit it in place; Enter writes it to the rule it is in.
- **Add a declaration:** type into the empty row at the end of the style attribute or of a rule.
- **Remove one:** empty it, or press × beside it.
- **Change a utility class:** edit its name.
- **Change a rule's selector:** edit it in the rule's heading; a selector the browser cannot read is refused. × deletes the rule.
- **New rule:** adds a rule for the element's id or kind to the diagram's `<style>`.

graphally's defaults are shown, not edited: a rule of the diagram's own overrides them.

## Selecting, and the rest

- **Select:** a click selects the box that moves as a whole; a second click goes one level in; Shift+click adds an element to the selection or takes it away, and several selected elements are deleted together, or grouped when they stand side by side in one parent. The arrow keys walk the tree: ↑ and ↓ the siblings, ← the parent, → the first child. The path above the drawing selects any element on the way to the selection, and the layers panel lists every element, including chips and rows that have no id.
- **Text:** double-click it, or press Enter.
- **Properties:** id (a new one carries the box's lines, the points they pass by and its `#id` rules with it; a drawing script or attribute that still names the old id is pointed out), classes, text, icon (with the names graphally knows) and variants; the element's column, row and span, area or nudge as fields; its lines, each a button that selects it.
- **Duplicate (Ctrl+D), Delete:** a copy gets ids with `-2`; deleting takes the lines to the ids inside.
- **Zoom:** −, +, 100% and Fit, Ctrl+wheel, Shift+1 (fit) and Shift+0 (100%).
- **Undo and Redo:** step through every change to the file while the canvas is open: yours, the agent's, and those from other programs.
- **A narrow panel:** below 1100px the layers slide in from the Layers button; below 760px the properties sit under the drawing.
- **Images and parts:** an `<img>` or an included part beside the diagram file loads as in a render.

## What the agent can do

| Action | What it does |
|---|---|
| `get_diagram` | Reads the file's path and source, its connections (each with the key that names it), its elements as layers (each with its path), its CSS (`styles.rules`, each with its index) and your selection. |
| `apply_edits` | Edits the file: `text`, `attr`, `cell`, `place`, `remove`, `duplicate`, `insert`, `wrap`, `unwrap` and `style` on elements, named by id or by path; `rule` on the diagram's `<style>`; `move` and `nudge` on boxes; `connect`, `line` and `unline` on lines. It reports the edits that failed, and why. |
| `get_selection` | Reads the elements and lines you selected. |
| `select` | Selects elements and lines for you, to point at them. |

## Safety

The canvas's server listens on `127.0.0.1` only, under a secret path that only its page is given. It answers only requests that name it as the page does (a site that points its name at 127.0.0.1 is refused) and takes changes only as JSON from its own origin, so another site open in the same browser cannot read or edit the diagram. Every edit says which version of the source it was made against: the one shown when the drag began, the text editor opened or the panel was drawn. One made against an older version (its paths may name other elements now) is refused, and the page draws the file afresh; a field with typing not yet written is left as it is meanwhile. The file is read again before each edit, preview and undo, so a change another program made is never overwritten; while another program is still writing it, the edit waits for a second try. Edits refuse to put a block (a `<div>`, a `<p>`) in a paragraph, a heading or a span, or anything but a table's parts in a table, where the browser would rearrange the elements. When the file already holds such HTML and the browser numbers its elements differently from how they are written, the canvas says where and edits nothing until it is fixed, as an edit by path would land on the wrong element.

## How it is built

- **Paths:** an element's path is its place among the elements of `<diagram>`, `0.2.1`. The edit module reads them from the source text (`edits/tree.mjs`), and the page stamps the same paths onto the elements it renders (`data-src`). One number names one element on both sides.
- **The layout model:** when a diagram carries `data-edit`, the viewer also returns each element's box and what places it: grid tracks, gaps and named areas, flex direction, flow (`engine/page/layout-model.js`). Without `data-edit`, a render is unchanged.
- **CSS:** the edit module reads the diagram's `<style>` rules with where each declaration sits (`edits/css-rules.mjs`) and changes one at a time (`edits/styling.mjs`). The page matches rules to the selection on the source as parsed, and orders them by specificity and source order (`app/cascade.js`, `app/selectors.js`).
- **The drop:** `app/drop.js` asks the model what holds the pointer: a cell or an area of a grid (`app/grid-drop.js`), or a place between two siblings; `app/placement.js` writes the new place where the source keeps it.
- **The preview:** `app/preview.js` sends a drag's edits to the server's preview endpoint, which applies them without writing, and draws the result under the overlay (`drawPreview` in `app/stage.js`). It renders that one diagram alone (`graphally.render(diagram)`).
- **`extension.mjs`:** registers the canvas and its actions with the app (`@microsoft/copilot-sdk/extension`, which the app provides).
- **`instances.mjs`, `session.mjs`, `server.mjs`, `styles.mjs` and `icons.mjs`:** know nothing of the app, and `tools/test/canvas.mjs` tests them on their own. Each open canvas is a session on one file, served with the page, the viewer and a stream of the file's state.
- **`app/`:** the page. It draws with the skill's viewer bundle (`skills/graphally/viewer/graphally.min.js`), so it lays out and routes exactly as a render does.

## Known limits

- Rules that nest rules are shown, not edited.
- A line a drawing script draws can be selected but not edited from the panel. The canvas says so; edit it in the script.
- A line split out of a list is written last in the connections.
- Several selected elements are deleted or grouped together; they are moved and styled one at a time.

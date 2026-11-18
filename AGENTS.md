# Working on graphally

graphally renders diagrams written as HTML and CSS: a browser lays the page out, and the engine
reads it back and writes SVG. `README.md` says what lives where; `docs/design.md` explains how
the pipeline works; `skills/graphally/references/format.md` is the diagram format, the contract
that changes must keep.

## Commands

- `node tools/test.mjs`: the suite (renders every sample and docs diagram, then small cases).
- `bash tools/render-diagrams.sh`: re-renders the samples and docs diagrams in place.
- `node tools/build-viewer.mjs`: rebuilds `skills/graphally/viewer/graphally.min.js`.

On a pull request the render workflow re-renders the diagrams and rebuilds the viewer itself,
and pushes the result to the branch.

## Code

- No dependencies: Node 18 or later and an installed Chrome, Chromium or Edge. Engine modules
  are plain ES modules that the browser loads as they are, and that esbuild bundles into the
  viewer.
- One concern per file, up to about 200 lines; functions up to about 40 lines; lines up to 110
  characters. Names in full words.
- SVG markup is written through `svg.js` (`svgElement`, `openTag`, `boxAttributes`), never by
  string concatenation. Reading the computed style (`paint.js`) stays apart from drawing.
- A refactor changes no output: every sample and docs diagram renders byte for byte as before.
- Tests cover basic behaviour; add one for a new feature or a fixed bug, not for every case.

## Pull requests

One branch and pull request per task, named `feature/…` or `fix/…`. The label (`build`,
`minor`, `major`) chooses the release a merge makes; see Releases in `README.md`.

# Fonts

Every figure is set in the theme's Inter unless it says otherwise. A figure for a client, a slide
or a poster often wants a face with more character, or the client's own. The render measures
the text in the face it is drawn in and puts the font inside the SVG, so the figure looks the
same on every machine.

## Contents

- [Choosing type](#choosing-type): the brand's face first, then a voice, two families at most
- [A Google font](#a-google-font): `fonts="…"` on `<diagram>`
- [A font file of your own](#a-font-file-of-your-own): a licensed brand font, in `@font-face`
- [Licences and embedding](#licences-and-embedding)
- [Installed fonts](#installed-fonts)
- [In the drawing script](#in-the-drawing-script)
- [Problems](#problems)

## Choosing type

- **The client's brand font**, when it has one: its readers know it from everything else they
  receive. Ask for the files, or use the Google font its brand guide names.
- **Two families at most**: one display face for titles, big numbers and labels, one text face
  for sentences, or one family in two weights. A third family reads as noise (Visme's design
  guide; Lupton, *Thinking with Type*).
- **Pair by clear contrast, or stay in one family**: a condensed display face over a
  normal-width text face of the same build, a serif title over a sans text, a heavy weight over
  a regular one. Two faces that differ only a little conflict, and read as a mistake (Williams,
  *The Non-Designer's Design Book*: concord, conflict, contrast).
- **Plain by default**: one family, Inter (the theme's), IBM Plex Sans with Plex Mono, or Arimo
  (Arial's metrics), with weight for the hierarchy. The voices below are for a user or brand
  that asks for a display face; pick one family from its list, with no test renders:
  - condensed grotesques fit many big numbers and long titles in little width: industry,
    operations, logistics (Sofia Sans Condensed, Antonio, Archivo Narrow, Oswald, Saira
    Condensed, Roboto Condensed, IBM Plex Sans Condensed, Barlow Condensed, Fjalla One);
  - geometric sans read as modern and plain: technology, products (Outfit, Urbanist, Lexend,
    Sora, Plus Jakarta Sans, Montserrat, Poppins);
  - grotesque and neo-grotesque sans are neutral and dense: reports, dashboards, engineering
    (Manrope, Work Sans, Public Sans, Schibsted Grotesk, Hanken Grotesk, IBM Plex Sans, Inter);
  - humanist sans are warm and legible small: public services, health, education (Source Sans
    3, Fira Sans, Nunito Sans, Mukta, Open Sans);
  - serifs carry authority and heritage: finance, law, publishing, editorial pages (Source
    Serif 4, Newsreader, Fraunces, Literata, Libre Caslon Text, Playfair Display, IBM Plex Serif);
  - slabs and monospaces suit engineering and code (Zilla Slab, Roboto Slab, JetBrains Mono,
    IBM Plex Mono).
- **Small text needs a text face**: condensed, decorative and hairline faces are drawn for
  display sizes; set sentences and footnotes in the text face.
- **Characters the face lacks** fall back to another font without a warning: subscripts and
  superscripts (CO₂), arrows, symbols. Write `CO<sub>2</sub>`, draw an arrow as an icon or a
  line, and look for them in the PNG.

## A Google font

Any family on fonts.google.com, named on `<diagram>` with the weights the CSS uses:

```html
<diagram fonts="Barlow Condensed:700,800; Barlow:400,600">
<style> h1 { font-family: 'Barlow Condensed', sans-serif; font-weight: 800 } </style>
```

- A family without weights is 400. Name every weight the CSS asks for: a weight not loaded is
  replaced by the nearest one loaded, or thickened by the browser into a fake bold.
- The render downloads each face once (from Fontsource, the same files under the same open
  licences), with the scripts the text uses: Latin always, Latin Extended, Greek or Cyrillic
  when the text has them.
- The browser viewer loads the same files from the same place.

## A font file of your own

A licensed brand font comes as files (`.ttf`, `.otf`, `.woff`, `.woff2`). Declare each face in
the diagram's `<style>` with CSS's own `@font-face`, the path relative to the diagram file:

```html
<style>
  @font-face { font-family: 'Acme Sans'; font-weight: 400; src: url(../brand/fonts/AcmeSans-Regular.woff2); }
  @font-face { font-family: 'Acme Sans'; font-weight: 700; src: url(../brand/fonts/AcmeSans-Bold.woff2); }
  .page { font-family: 'Acme Sans', sans-serif; }
</style>
```

- **One rule per weight and style**, each with its file; the family name is yours to choose, and
  the CSS uses it. A variable font is one rule with a range: `font-weight: 100 900`.
- **The path may leave the diagram's folder**, so one brand folder serves every diagram in a
  repository. An `https:` address works too, where its server allows fonts to be fetched.
- **Prefer `.woff2`**: the SVG holds the file, and a woff2 is often less than half a ttf's size.
- The browser viewer loads the files relative to the page, when the page is served; a diagram
  opened from disk cannot read them, so render it. The canvas of the GitHub Copilot app reads
  files inside the diagram's own folder only.

## Licences and embedding

The SVG holds the font files, so sending the SVG sends the fonts. Google fonts are under open
licences (mostly the SIL Open Font License, a few Apache or the Ubuntu Font Licence), which allow
this. A commercial font's licence may
not: desktop licences often forbid placing the font file in documents others receive, and web
licences cover serving it on a site. Ask whoever holds the licence. Where embedding is not
allowed, `embed-fonts="no"` on `<diagram>` lays the figure out in the font but leaves the files
out of the SVG: the SVG shows the font where it is installed and falls back elsewhere, and the
PNG shows it everywhere. Hand readers outside the PNG, rendered with `--png2x`; desktop licences
usually allow static images made with the font, but check yours. Keep the SVG for readers who
have the font installed: in another font the text keeps its places and may collide.

## Installed fonts

A family installed on the machine that renders (`font-family: 'Acme Sans'`) is measured and
drawn in the PNG, but the SVG only names it, and shows it only where it is installed. Declare
the file with `@font-face` instead, so the SVG holds it.

## In the drawing script

`text(p, '210 ms', { font: 'Barlow Condensed', weight: 800, size: 22 })` sets a script's text in
a family the diagram loads.

## Problems

| The render says | Do this |
|---|---|
| `warning: font-missing` with a family | the Google family could not be loaded: check its name on fonts.google.com, or render once online |
| `warning: font-missing` with a file | the file could not be read: check its path from the diagram file, and that it is a ttf, otf, woff or woff2 |
| text in Inter where you asked for a face | the family or the weight is not loaded: name it in `fonts`, or give it an `@font-face` |

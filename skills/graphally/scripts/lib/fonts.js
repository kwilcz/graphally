// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The display fonts a diagram names: <diagram fonts="Barlow Condensed:700,800; Barlow:400,600">.
// Each family is a Google font, taken from Fontsource (the same files, open licences), one file per
// weight and per script its text uses. Shared by the render (Node), its page and the browser
// viewer, so it uses nothing but strings.

export const FONTSOURCE = 'https://cdn.jsdelivr.net/npm/@fontsource';

// The scripts a font is split into: the characters each holds (as @font-face's unicode-range
// says), and the text that needs it. Latin is always loaded; the others when the text uses them.
const SUBSETS = [
  ['latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, '
    + 'U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD', /./s],
  ['latin-ext', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, '
    + 'U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  /[\u0100-\u02FF\u1E00-\u1EFF]/],
  ['greek', 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF', /[\u0370-\u03FF]/],
  ['cyrillic', 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116', /[\u0400-\u04FF]/],
];

const slugOf = family => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "Barlow Condensed:700,800; Barlow" -> [{ family, slug, weights }]; a family without weights is 400.
export function parseFonts(value) {
  return String(value || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [name, weights = '400'] = part.split(':');
    const family = name.trim().replace(/^['"]|['"]$/g, '');
    const named = weights.split(',').map(weight => weight.trim()).filter(weight => /^[1-9]00$/.test(weight));
    return { family, slug: slugOf(family), weights: named };
  }).filter(font => font.slug && font.weights.length);
}

// Every face a diagram needs: one per family, weight and script its text uses.
export function facesFor(value, text) {
  const subsets = SUBSETS.filter(([, , needed]) => needed.test(text));
  const faceOf = (family, slug, weight) => ([subset, range]) => ({
    family, slug, weight, subset, range, file: `${slug}-${subset}-${weight}-normal.woff2`,
  });
  return parseFonts(value).flatMap(({ family, slug, weights }) => weights
    .flatMap(weight => subsets.map(faceOf(family, slug, weight))));
}

// Where Fontsource keeps a face.
export const fontUrl = face => `${FONTSOURCE}/${face.slug}@5/files/${face.file}`;

// The @font-face rule for a face, its source a URL or embedded data.
export const faceRule = (face, src) => `@font-face{font-family:'${face.family}';font-weight:${face.weight};`
  + `font-style:normal;unicode-range:${face.range};src:url(${src}) format('woff2')}`;

// The text a diagram shows, for choosing scripts: its content and its title and subtitle.
export const diagramText = diagram => [diagram.textContent, diagram.getAttribute('title'),
  diagram.getAttribute('subtitle')].filter(Boolean).join(' ');

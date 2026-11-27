// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A diagram's display fonts in the browser viewer, loaded before the diagram is drawn so its text is
// measured in them: each Google face it names, from Fontsource, and each file its @font-face rules
// name, relative to the page. A diagram's styles are its own (muted on the page, copied into the
// layout's shadow root, where a browser ignores @font-face), so the faces join the document's
// fonts. A face that cannot load leaves the theme's font.
import { facesFor, fontUrl, diagramText } from '../fonts.js';
import { declaredFaces, faceDescriptors, typeOf } from '../font-files.js';

async function loadFace(family, source, descriptors) {
  try {
    const font = new FontFace(family, source, descriptors);
    await font.load();
    document.fonts.add(font);
  } catch {}
}

const googleFace = face => loadFace(face.family, `url(${fontUrl(face)})`,
  { weight: face.weight, unicodeRange: face.range });

function fileFace(face) {
  const format = typeOf(face.url)?.format, url = new URL(face.url, document.baseURI).href;
  return loadFace(face.family, `url("${url}")${format ? ` format("${format}")` : ''}`, faceDescriptors(face));
}

export async function loadFonts(diagram) {
  const google = facesFor(diagram.getAttribute('fonts'), diagramText(diagram));
  await Promise.all([...google.map(googleFace), ...declaredFaces(diagram).map(fileFace)]);
}

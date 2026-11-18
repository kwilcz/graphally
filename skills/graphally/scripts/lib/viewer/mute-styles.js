// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A diagram's <style> is for that diagram, but a browser applies a <style> to the whole page
// wherever it sits. Each one is switched off as soon as it is parsed (and again whenever it is
// rewritten, which makes a new sheet); compile() lays the diagram out with a copy of it.
const LINKED_SHEETS = 'diagram link[rel~="stylesheet"]';
const SHEETS = `diagram style, ${LINKED_SHEETS}`;

export function muteDiagramStyles() {
  for (const sheet of document.querySelectorAll(SHEETS)) {
    if (sheet.sheet && !sheet.sheet.disabled) sheet.sheet.disabled = true;
  }
}

export function keepDiagramStylesMuted() {
  muteDiagramStyles();
  new MutationObserver(muteDiagramStyles).observe(document.documentElement, { childList: true, subtree: true });
  for (const link of document.querySelectorAll(LINKED_SHEETS)) link.addEventListener('load', muteDiagramStyles);
}

// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// One open canvas: the diagram file it edits, the pages showing it, and what is selected. Every
// change, from the page, the agent or an edit made to the file outside the canvas, reaches every
// page showing the file.
import { readFileSync, writeFileSync, watchFile, unwatchFile } from 'node:fs';
import { relative } from 'node:path';
import { applyEdits, readLines } from '../../../skills/graphally/scripts/lib/edits.mjs';

// How often the file is checked for edits made outside the canvas, in milliseconds.
const WATCH_INTERVAL = 250;

// The connections of a source as data, or none when it holds no diagram (yet).
function linesOf(source) {
  try {
    return readLines(source);
  } catch {
    return [];
  }
}

export class CanvasSession {
  constructor(filePath) {
    Object.assign(this, { filePath, pages: new Set(), selection: [], source: readFileSync(filePath, 'utf8') });
    this.onFileChange = () => this.reload();
    watchFile(filePath, { interval: WATCH_INTERVAL }, this.onFileChange);
  }

  // What a page or the agent reads: the file (and its path in the workspace), its source, its
  // connections and the selection.
  state() {
    const { filePath, source, selection } = this;
    return { filePath, name: relative(process.cwd(), filePath), source, lines: linesOf(source), selection };
  }

  // Applies edits, in the skill's edit format, and writes the file when any applied.
  edit(edits) {
    const result = applyEdits(this.source, edits);
    if (result.applied.length) this.write(result.source);
    return { applied: result.applied, errors: result.errors };
  }

  // Boxes and lines picked on the page or by the agent: [{ kind: 'box' | 'line', id }]. Pages get
  // it as an event of its own, so they redraw the outline and not the diagram.
  select(items) {
    this.selection = items;
    const message = `event: selection\ndata: ${JSON.stringify(items)}\n\n`;
    for (const page of this.pages) page.write(message);
  }

  write(source) {
    this.source = source;
    writeFileSync(this.filePath, source, 'utf8');
    this.broadcast();
  }

  // The file changed outside the canvas: every page shows it. A read in the middle of another
  // program's write is skipped; the next check reads the whole file.
  reload() {
    let source;
    try {
      source = readFileSync(this.filePath, 'utf8');
    } catch {
      return;
    }
    if (source === this.source) return;
    this.source = source;
    this.broadcast();
  }

  // A page joins, on a server-sent event stream: it gets the state now and every change after.
  addPage(response) {
    const headers = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' };
    response.writeHead(200, headers);
    response.write(`data: ${JSON.stringify(this.state())}\n\n`);
    this.pages.add(response);
    response.on('close', () => this.pages.delete(response));
  }

  broadcast() {
    const message = `data: ${JSON.stringify(this.state())}\n\n`;
    for (const page of this.pages) page.write(message);
  }

  close() {
    unwatchFile(this.filePath, this.onFileChange);
    for (const page of this.pages) page.end();
    this.pages.clear();
  }
}

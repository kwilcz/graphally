// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// One open canvas: the diagram file it edits, the pages showing it, what is selected, and the
// sources before and after each change, to undo and redo. Every change, from the page, the agent
// or an edit made to the file outside the canvas, reaches every page showing the file.
import { readFileSync, writeFileSync, watchFile, unwatchFile } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { applyEdits, readLines } from '../../../skills/graphally/scripts/lib/edits.mjs';
import { outlineOf } from './outline.mjs';
import { stylesOf } from './styles.mjs';

// How often the file is checked for edits made outside the canvas, in milliseconds.
const WATCH_INTERVAL = 250;
// How many changes undo reaches back.
const HISTORY = 100;

function linesOf(source) {
  try {
    return readLines(source);
  } catch {
    return [];
  }
}

// The file's path in the workspace, or its whole path when it lies outside it.
function nameOf(filePath) {
  const inside = relative(process.cwd(), filePath);
  return inside.startsWith('..') || isAbsolute(inside) ? filePath : inside;
}

const STALE = { message: 'The diagram changed as you worked; it is drawn again now. Try once more.' };

const event = (name, value) => `${name ? `event: ${name}\n` : ''}data: ${JSON.stringify(value)}\n\n`;

export class CanvasSession {
  constructor(filePath) {
    Object.assign(this, { filePath, pages: new Set(), selection: [], undone: [], done: [], version: 0 });
    this.source = readFileSync(filePath, 'utf8');
    this.onFileChange = () => this.reload();
    watchFile(filePath, { interval: WATCH_INTERVAL }, this.onFileChange);
  }

  // What a page or the agent reads: the file (and its path in the workspace), its source, its
  // connections, its elements as layers, its CSS, the selection, and whether undo and redo can go on.
  state() {
    const { filePath, source, selection } = this;
    return {
      filePath, name: nameOf(filePath), source, lines: linesOf(source), layers: outlineOf(source),
      styles: stylesOf(source), selection, canUndo: this.done.length > 0, canRedo: this.undone.length > 0,
      version: this.version,
    };
  }

  // Applies edits, in the skill's edit format, and writes the file when any applied. Edits made
  // against an older version of the source (their paths may name other elements now) are refused.
  edit(edits, version) {
    if (version !== undefined && version !== this.version) return { applied: [], errors: [STALE], stale: true };
    const result = applyEdits(this.source, edits);
    if (result.applied.length) this.change(result.source);
    return { applied: result.applied, errors: result.errors };
  }

  // The source as these edits would leave it, for a page to draw while a drag goes on; the file
  // stays as it is.
  preview(edits, version) {
    if (version !== undefined && version !== this.version) return { source: this.source, errors: [STALE], stale: true };
    const result = applyEdits(this.source, edits);
    return { source: result.source, errors: result.errors };
  }

  undo() {
    if (this.done.length) this.restore(this.done, this.undone);
  }

  redo() {
    if (this.undone.length) this.restore(this.undone, this.done);
  }

  // Boxes, elements and lines picked on the page or by the agent. Pages get it as an event of its
  // own, so they redraw the outline and not the diagram.
  select(items) {
    this.selection = items;
    for (const page of this.pages) page.write(event('selection', items));
  }

  // A new source, after this one: what undo goes back to, with redo cleared. The file is written
  // first, so a source that cannot be written changes nothing; one read from the file is not
  // written back.
  change(source, { fromFile = false } = {}) {
    if (!fromFile) writeFileSync(this.filePath, source, 'utf8');
    this.done = [...this.done, this.source].slice(-HISTORY);
    this.undone = [];
    this.show(source);
  }

  restore(from, to) {
    writeFileSync(this.filePath, from.at(-1), 'utf8');
    to.push(this.source);
    this.show(from.pop());
  }

  show(source) {
    this.source = source;
    this.version += 1;
    this.broadcast();
  }

  // The file changed outside the canvas: a change like any other, which every page shows. A read
  // in the middle of another program's write is skipped; the next check reads the whole file.
  reload() {
    let source;
    try {
      source = readFileSync(this.filePath, 'utf8');
    } catch {
      return;
    }
    if (source !== this.source) this.change(source, { fromFile: true });
  }

  // A page joins, on a server-sent event stream: it gets the state now and every change after.
  addPage(response) {
    const headers = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' };
    response.writeHead(200, headers);
    response.write(event(null, this.state()));
    this.pages.add(response);
    response.on('close', () => this.pages.delete(response));
  }

  broadcast() {
    const message = event(null, this.state());
    for (const page of this.pages) page.write(message);
  }

  close() {
    unwatchFile(this.filePath, this.onFileChange);
    for (const page of this.pages) page.end();
    this.pages.clear();
  }
}

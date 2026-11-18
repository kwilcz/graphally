// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// HCL, the subset configurations use: blocks with labels and attributes, every kind of comment.
// An attribute's expression is kept as its text (strings, interpolations, heredocs and nested
// brackets read whole). A body is { attrs: { name: expression }, blocks: [body with type and
// labels] }.

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]*/;
const HEREDOC = /^<<-?([A-Za-z_]+)[^\n]*\n/;

class Reader {
  constructor(source) {
    this.source = source;
    this.at = 0;
  }

  get char() { return this.source[this.at]; }

  // Spaces, tabs and comments; line ends too when newlines is set.
  skipBlank(newlines) {
    while (this.skipOne(newlines));
  }

  // One blank character or comment, if there is one there.
  skipOne(newlines) {
    const c = this.char, next = this.source[this.at + 1];
    if (c === ' ' || c === '\t' || c === '\r' || (newlines && c === '\n')) this.at++;
    else if (c === '#' || (c === '/' && next === '/')) this.skipTo(this.source.indexOf('\n', this.at), 0);
    else if (c === '/' && next === '*') this.skipTo(this.source.indexOf('*/', this.at + 2), 2);
    else return false;
    return true;
  }

  // To a found position and past it by some characters, or to the end.
  skipTo(found, past) { this.at = found < 0 ? this.source.length : found + past; }

  atComment() {
    const c = this.char, next = this.source[this.at + 1];
    return c === '#' || (c === '/' && (next === '/' || next === '*'));
  }

  identifier() {
    const match = IDENTIFIER.exec(this.source.slice(this.at, this.at + 256));
    if (!match) return null;
    this.at += match[0].length;
    return match[0];
  }

  // A quoted string, its escapes read and its interpolations kept as written.
  string() {
    const { source } = this;
    let text = '';
    this.at++;
    while (this.at < source.length && source[this.at] !== '"') {
      if (source[this.at] === '\\') {
        text += source[this.at + 1];
        this.at += 2;
      } else if (source[this.at] === '$' && source[this.at + 1] === '{') {
        const start = this.at;
        this.interpolation();
        text += source.slice(start, this.at);
      } else {
        text += source[this.at++];
      }
    }
    this.at++;
    return text;
  }

  interpolation() {
    const { source } = this;
    this.at += 2;
    for (let depth = 1; this.at < source.length && depth;) {
      const c = source[this.at];
      if (c === '"') {
        this.string();
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      this.at++;
    }
  }

  // <<EOT … EOT, or <<-EOT with the end marker indented.
  heredoc() {
    const { source } = this, match = HEREDOC.exec(source.slice(this.at, this.at + 64));
    if (!match) {
      this.at += 2;
      return;
    }
    const bodyStart = this.at + match[0].length - 1;
    const end = new RegExp(`\\n\\s*${match[1]}\\s*(\\n|$)`).exec(source.slice(bodyStart));
    this.at = end ? bodyStart + end.index + end[0].length - 1 : source.length;
  }

  // An expression: to the end of its line, or past it while brackets are open.
  expression() {
    const start = this.at;
    for (let depth = 0; depth >= 0 && this.at < this.source.length;) depth = this.expressionPiece(depth);
    return this.source.slice(start, this.at).trim();
  }

  // Reads one piece of an expression: the bracket depth after it, or -1 where the expression ends
  // (a line end, a closing bracket or a comment outside any bracket).
  expressionPiece(depth) {
    const c = this.char;
    if (c === '"') this.string();
    else if (c === '<' && this.source[this.at + 1] === '<') this.heredoc();
    else if (this.atComment()) {
      if (!depth) return -1;
      this.skipBlank(true);
    } else if (!depth && (c === '\n' || ')]}'.includes(c))) return -1;
    else return this.bracket(c, depth);
    return depth;
  }

  bracket(c, depth) {
    this.at++;
    if ('([{'.includes(c)) return depth + 1;
    return ')]}'.includes(c) ? depth - 1 : depth;
  }

  body() {
    const node = { attrs: {}, blocks: [] };
    for (;;) {
      this.skipBlank(true);
      if (this.at >= this.source.length) return node;
      if (this.char === '}') {
        this.at++;
        return node;
      }
      this.entry(node);
    }
  }

  // An attribute (key = expression) or a block (type "label" … { body }).
  entry(node) {
    const key = this.identifier();
    if (!key) {
      this.at++;
      return;
    }
    this.skipBlank(false);
    if (this.char === '=' && this.source[this.at + 1] !== '=') {
      this.at++;
      this.skipBlank(false);
      node.attrs[key] = this.expression();
      return;
    }
    const labels = this.labels();
    if (this.char === '{') node.blocks.push(this.block(key, labels));
  }

  block(type, labels) {
    this.at++;
    return Object.assign(this.body(), { type, labels });
  }

  // A block's labels: resource "azurerm_subnet" "app" {.
  labels() {
    const labels = [];
    while (this.at < this.source.length && this.char !== '{' && this.char !== '\n') {
      if (this.char === '"') labels.push(this.string());
      else if (!this.identifier()) this.at++;
      this.skipBlank(false);
    }
    return labels;
  }
}

export const parseHcl = source => new Reader(source).body();

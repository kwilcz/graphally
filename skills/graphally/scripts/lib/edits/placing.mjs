// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Where markup is cut from and put into a diagram's text so it reads as if written there: an
// element on lines of its own leaves with its lines and arrives on lines of its own, indented as
// the elements around it; one inside a line moves as it stands.

const onlySpaces = text => /^[ \t]*$/.test(text);
const lineStart = (text, at) => text.lastIndexOf('\n', at - 1) + 1;
const indentOf = (text, at) => text.slice(lineStart(text, at), at).match(/^[ \t]*/)[0];
const startsLine = (text, at) => onlySpaces(text.slice(lineStart(text, at), at));

// The end of the line `at` is on, past its newline, when only spaces follow; else null.
function endsLineAt(text, at) {
  const newline = text.indexOf('\n', at), end = newline < 0 ? text.length : newline;
  return onlySpaces(text.slice(at, end)) ? Math.min(text.length, end + 1) : null;
}

// What removing an element takes: its whole lines when it has them to itself.
export function cutOf(text, node) {
  const lineEnd = endsLineAt(text, node.end);
  if (startsLine(text, node.start) && lineEnd !== null) return { start: lineStart(text, node.start), end: lineEnd };
  return { start: node.start, end: node.end };
}

// Where markup goes to stand before a sibling, or last in a container: on a line of its own
// when the elements there have theirs.
export function spotOf(text, container, before) {
  if (before) {
    return startsLine(text, before.start)
      ? { at: lineStart(text, before.start), indent: indentOf(text, before.start), block: true }
      : { at: before.start, indent: '', block: false };
  }
  const last = container.children.filter(child => !child.virtual).at(-1);
  const lastEnd = last && endsLineAt(text, last.end);
  if (last && lastEnd !== null && startsLine(text, last.start)) {
    return { at: lastEnd, indent: indentOf(text, last.start), block: true };
  }
  if (last) return { at: last.end, indent: '', block: false };
  if (startsLine(text, container.closeStart)) {
    const indent = `${indentOf(text, container.closeStart)}  `;
    return { at: lineStart(text, container.closeStart), indent, block: true };
  }
  return { at: container.closeStart, indent: '', block: false };
}

// Where markup goes to stand right after an element.
export function spotAfter(text, node) {
  const lineEnd = endsLineAt(text, node.end);
  if (startsLine(text, node.start) && lineEnd !== null) {
    return { at: lineEnd, indent: indentOf(text, node.start), block: true };
  }
  return { at: node.end, indent: '', block: false };
}

// Markup made to stand at a spot: its later lines moved from one indent to the other, and on a
// line of its own when the spot is.
export function fitted(markup, fromIndent, spot) {
  const lines = markup.split('\n').map((line, index) => {
    if (index === 0 || !line.startsWith(fromIndent)) return line;
    return spot.indent + line.slice(fromIndent.length);
  });
  return spot.block ? `${spot.indent}${lines.join('\n')}\n` : lines.join('\n');
}

// The indent an element's lines are written at.
export const indentOfNode = (text, node) => (startsLine(text, node.start) ? indentOf(text, node.start) : '');

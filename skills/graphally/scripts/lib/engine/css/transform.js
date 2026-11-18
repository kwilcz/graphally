// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// rotate, scale and transform: what turns an element, as one matrix.

// The element's rotate, scale and transform as one matrix, or null when together they only
// move it: the browser's boxes already show a move (translate, nudge), but not a turn.
export function turnMatrixOf(style) {
  const parts = [
    style.rotate !== 'none' && `rotate(${style.rotate})`,
    style.scale !== 'none' && `scale(${style.scale.split(' ').join(',')})`,
    style.transform !== 'none' && style.transform,
  ].filter(Boolean);
  if (!parts.length) return null;
  try {
    const matrix = new DOMMatrix(parts.join(' '));
    // How far the matrix's linear part is from the identity: nothing means only a move.
    const linearPart = [matrix.a - 1, matrix.b, matrix.c, matrix.d - 1];
    const change = linearPart.reduce((sum, value) => sum + Math.abs(value), 0);
    return change < 1e-6 ? null : matrix;
  } catch {
    // A rotate about a 3D axis, which a 2D matrix cannot hold.
    return null;
  }
}

// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Editing an element's own text where it stands: a field over the element, which writes the text
// on Enter or when the field is left, and leaves it as it was on Escape.

function placeOver(field, svg, box) {
  const m = svg.getScreenCTM();
  Object.assign(field.style, {
    left: `${box.x * m.a + m.e}px`, top: `${box.y * m.d + m.f}px`,
    width: `${Math.max(140, box.w * m.a)}px`, height: `${Math.max(26, Math.min(box.h * m.d, 40))}px`,
  });
}

export function editText(svg, box, text, onChange) {
  const field = Object.assign(document.createElement('input'), { className: 'text-field', value: text });
  placeOver(field, svg, box);
  document.body.append(field);
  field.focus();
  field.select();
  let finished = false;
  const finish = keep => {
    if (finished) return;
    finished = true;
    field.remove();
    if (keep && field.value !== text) onChange(field.value);
  };
  field.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });
  field.addEventListener('blur', () => finish(true));
}

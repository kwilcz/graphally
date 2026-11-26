// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Making the panels' elements.

export function element(name, properties = {}, children = []) {
  const made = Object.assign(document.createElement(name), properties);
  made.append(...children.filter(child => child !== null && child !== undefined && child !== false));
  return made;
}

export function button(text, onClick, title = '') {
  const made = element('button', { type: 'button', textContent: text, title });
  made.addEventListener('click', onClick);
  return made;
}

// A text field that reports its value once it is changed (Enter or leaving it) and puts the old
// value back on Escape.
export function textField(value, onChange, { list, ...properties } = {}) {
  const input = element('input', { value: value ?? '', spellcheck: false, ...properties });
  if (list) input.setAttribute('list', list);   // a datalist is named by attribute only
  input.addEventListener('change', () => onChange(input.value.trim()));
  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    input.value = value ?? '';
    input.blur();
  });
  return input;
}

export const field = (label, value, onChange) => element('label', {}, [label, textField(value, onChange)]);

// A part of a panel that can be folded away, open to begin with.
export function section(title, children, open = true) {
  return element('details', { className: 'section', open }, [element('summary', { textContent: title }), ...children]);
}

// Text as written in markup, read as the browser reads it: every character reference decoded.
const reader = document.createElement('textarea');
export function decodedText(markup) {
  reader.innerHTML = markup;
  return reader.value;
}

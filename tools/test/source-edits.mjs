// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The edits of a diagram's structure and CSS, as text patches: each changes what it names and
// leaves the rest of the source as written.
import { applyEdits } from '../../skills/graphally/scripts/lib/edits.mjs';
import { check } from './helpers.mjs';

const SOURCE = `<diagram title="Edits">
  <style>
    .lane { display: flex; gap: 8px; }
    .card { padding: 4px; }
  </style>
  <div class="lane col-[2]" id=lane>
    <div class=card id=a>A</div>
    <div class=card id=b>B</div>
  </div>
  <script type="application/json">[{ "from": "a", "to": "b" }, { "from": "lane", "to": "b" }]</script>
</diagram>
`;

function edited(edits) {
  const result = applyEdits(SOURCE, edits);
  check(!result.errors.length, `edits failed: ${JSON.stringify(result.errors)}`);
  return result.source;
}

const lineOf = (source, needle) => source.split('\n').find(line => line.includes(needle))?.trim();

export function sourceEdits() {
  const rule = edited([{ op: 'rule', selector: '.lane', set: { gap: '12px', 'align-items': 'center' } }]);
  check(lineOf(rule, '.lane {') === '.lane { display: flex; gap: 12px; align-items: center; }', 'rule: set and add');
  const fresh = edited([{ op: 'rule', selector: '#a', set: { color: 'var(--woad)' } }]);
  check(lineOf(fresh, '#a {') === '#a { color: var(--woad); }', 'rule: a new rule for a new selector');
  const renamed = edited([{ op: 'rule', rule: 1, rename: '.lane > .card' }]);
  check(lineOf(renamed, '.card {') === '.lane > .card { padding: 4px; }', 'rule: rename');
  const gone = edited([{ op: 'rule', rule: 1, remove: true }]);
  check(!gone.includes('.card {') && gone.includes('.lane {'), 'rule: remove');
  const inline = edited([{ op: 'style', id: 'a', set: { opacity: '0.5' } }]);
  check(lineOf(inline, 'id=a') === '<div class=card id=a style="opacity: 0.5">A</div>', 'style: set');
  const wrapped = edited([{ op: 'wrap', id: 'lane', html: '<div class="group">' }]);
  const wrapper = /<div class="group col-\[2\]">\n {4}<div class="lane" id=lane>/;
  check(wrapper.test(wrapped), 'wrap: placing classes go to the wrapper');
  const back = applyEdits(wrapped, [{ op: 'unwrap', path: '1' }]).source;
  check(back.includes('<div class="lane col-[2]" id=lane>') && !back.includes('group'),
    'unwrap: the classes come back');
  const out = edited([{ op: 'unwrap', id: 'lane' }]);
  const children = /\n {2}<div class=card id=a>A<\/div>\n {2}<div class=card id=b>B<\/div>\n/;
  check(children.test(out), 'unwrap: children one level out');
  check(out.includes('"from": "a"') && !out.includes('"from": "lane"'), 'unwrap: the container\'s lines go');
  const moved = edited([{ op: 'place', id: 'b', into: '1', before: '1.0' }]);
  check(moved.indexOf('id=b') < moved.indexOf('id=a'), 'place: before a sibling');
}

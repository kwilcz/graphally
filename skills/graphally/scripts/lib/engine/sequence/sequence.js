// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// Sequence diagrams: the placing an author should not do by hand, as one
// primitive a before-layout script calls. It decides where things go, not how they look:
// everything it makes is a plain element with a class, styled by CSS like the rest.
//
//   <div class=seq id=seq>
//     <div class=node id=shop data-who>…</div>                participants, in order
//     <div class="group external" data-who-group="stripe bank">Third parties</div>
//     <p class=msg data-from=shop data-to=pay>create payment</p>
//     <p class="msg reply" data-from=pay data-to=shop>client secret</p>
//     <div class=frag data-kind=alt data-guard="3-D Secure required">
//       <p class=msg …>…</p>
//       <div class=else data-guard="no 3-D Secure"></div>
//       <p class=msg …>…</p>
//     </div>
//   </div>
//
// sequence('#seq') gives the container a grid column per participant (lines named
// <id>-s and <id>-e), a row per message in document order, and makes: .lifeline under each
// participant, .activation from a call to its reply, .frag-box, .frag-tab and .frag-else
// for each fragment (spanning the participants its messages touch), and .num in each
// message. Messages from a participant to itself get the class self. The arrows are the
// diagram script's: each message knows its row, data-from and data-to.
const make = (cls, html = '') => {
  const element = document.createElement('div');
  element.className = cls;
  element.innerHTML = html;
  return element;
};
const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = text => String(text).replace(/[&<>"]/g, c => HTML_ENTITIES[c]);
const guardOf = guard => (guard ? `<span class=guard>[${escapeHtml(guard)}]</span>` : '');

// Rows in document order: a fragment takes a row for its tab and one to close it, an else a row
// for its divider, a message one row. Participants hold the first row.
class SequenceLayout {
  constructor(box, participants, options, problems) {
    Object.assign(this, { box, participants, options, problems });
    this.ids = participants.map(participant => participant.id);
    this.row = 2;
    this.count = 0;
    this.messages = [];
    this.fragments = [];
  }

  column(id) { return this.ids.indexOf(id); }

  span(lo, hi) { return `${this.ids[lo]}-s / ${this.ids[hi]}-e`; }

  // A grid column per participant, its lines named <id>-s and <id>-e.
  layOutColumns() {
    const { box, ids } = this;
    box.style.display = 'grid';
    const trackOf = (id, i) => `[${i ? `${ids[i - 1]}-e ` : ''}${id}-s] minmax(0, 1fr)`;
    box.style.gridTemplateColumns = `${ids.map(trackOf).join(' ')} [${ids.at(-1)}-e]`;
    for (const participant of this.participants) {
      participant.style.gridRow = '1';
      participant.style.gridColumn = `${participant.id}-s / ${participant.id}-e`;
    }
  }

  walk(parent, depth) {
    for (const element of [...parent.children]) this.place(element, depth);
  }

  place(element, depth) {
    if (element.matches('.msg')) this.message(element);
    else if (element.matches('.frag')) this.fragment(element, depth);
    else if (element.matches('.else')) this.elseDivider(element);
    else if (element.querySelector('.msg, .frag')) this.walk(element, depth);
  }

  // A message on its row, across its two participants; to oneself, it gets the class self.
  message(element) {
    const { from, to } = element.dataset, a = this.column(from), b = this.column(to);
    if (a < 0 || b < 0) {
      this.problems.push({ rule: 'unknown-id', id: a < 0 ? from : to, on: element.textContent.trim().slice(0, 40) });
      return;
    }
    element.style.gridRow = String(this.row);
    element.style.gridColumn = this.span(Math.min(a, b), Math.max(a, b));
    if (a === b) element.classList.add('self');
    element.append(this.labelOf(element));
    this.messages.push({
      element, a, b, row: this.row++,
      reply: element.matches('.reply'), async: element.matches('.async'),
    });
  }

  // The message's text in a label, numbered unless told not to.
  labelOf(element) {
    const label = document.createElement('span');
    label.className = 'label';
    label.append(...element.childNodes);
    if (this.options.number) label.prepend(this.nextNumber());
    return label;
  }

  // The next message number, in the span that shows it.
  nextNumber() {
    return Object.assign(document.createElement('span'), { className: 'num', textContent: String(++this.count) });
  }

  // A fragment spans the participants its messages touch; a message to oneself loops and is
  // labelled to the right, so the fragment covers that column too.
  fragment(element, depth) {
    const fragment = { element, depth, start: this.row++, elses: [], cols: [] };
    this.fragments.push(fragment);
    const before = this.messages.length;
    this.walk(element, depth + 1);
    const last = this.ids.length - 1;
    const columnsTouched = m => (m.a === m.b ? [m.a, Math.min(m.a + 1, last)] : [m.a, m.b]);
    fragment.cols = this.messages.slice(before).flatMap(columnsTouched);
    fragment.end = this.row++;
    element.style.display = 'contents';
  }

  elseDivider(element) {
    this.fragments.at(-1)?.elses.push({ guard: element.dataset.guard || '', row: this.row++ });
    element.style.display = 'none';
  }

  // A fragment's box, tab, else dividers and end, inset from the lifelines it spans.
  fragmentMarks({ element, depth, start, end, elses, cols }) {
    const columns = cols.length ? cols : [0], lo = Math.min(...columns), hi = Math.max(...columns);
    const placed = (mark, row) => {
      Object.assign(mark.style, { gridRow: row, gridColumn: this.span(lo, hi) });
      mark.style.setProperty('--k', hi - lo + 1);
      mark.style.setProperty('--depth', depth);
      return mark;
    };
    const { kind, guard } = element.dataset;
    return [
      placed(make(`frag-box ${kind || ''}`), `${start} / ${end + 1}`),
      placed(make('frag-tab', `<b>${escapeHtml(kind || 'opt')}</b>${guardOf(guard)}`), String(start)),
      ...elses.map(divider => placed(make('frag-else', guardOf(divider.guard)), String(divider.row))),
      placed(make('frag-end'), String(end)),
    ];
  }

  // A group of participants: a box behind their columns, from the top down.
  groups() {
    const groups = [];
    for (const group of this.box.querySelectorAll(':scope > [data-who-group]')) {
      const columns = group.dataset.whoGroup.split(/[\s,]+/).map(id => this.column(id)).filter(column => column >= 0);
      if (!columns.length) continue;
      const lo = Math.min(...columns), hi = Math.max(...columns);
      Object.assign(group.style, { gridRow: `1 / ${this.row}`, gridColumn: this.span(lo, hi) });
      group.style.setProperty('--k', hi - lo + 1);
      group.classList.add('who-group');
      groups.push(group);
    }
    return groups;
  }

  lifeline(id) {
    const line = make('lifeline');
    Object.assign(line.style, { gridRow: `2 / ${this.row}`, gridColumn: `${id}-s / ${id}-e` });
    return line;
  }

  // An activation runs from a call to the reply that answers it (or one row).
  activations() {
    if (!this.options.activations) return [];
    return this.messages.flatMap((call, index) => {
      if (call.reply || call.async || call.a === call.b) return [];
      const reply = this.messages.slice(index + 1).find(m => m.reply && m.a === call.b && m.b === call.a);
      const activation = make('activation');
      Object.assign(activation.style, {
        gridRow: `${call.row + 1} / ${(reply ? reply.row : call.row + 1) + 1}`,
        gridColumn: `${this.ids[call.b]}-s / ${this.ids[call.b]}-e`,
      });
      return [activation];
    });
  }

  run() {
    this.layOutColumns();
    this.walk(this.box, 0);
    const marks = this.fragments.flatMap(fragment => this.fragmentMarks(fragment));
    const groups = this.groups().reverse();
    this.box.prepend(...groups, ...marks, ...this.ids.map(id => this.lifeline(id)), ...this.activations());
    return { participants: this.ids, rows: this.row - 1, messages: this.messages.length };
  }
}

const rejected = (problems, hint) => {
  problems.push({ rule: 'bad-option', option: 'sequence', hint });
  return null;
};

export function sequence(box, { number = true, activations = true } = {}, problems) {
  if (!box) return rejected(problems, 'sequence(container): no such container');
  const participants = [...box.querySelectorAll(':scope > [data-who]')];
  if (!participants.length) {
    return rejected(problems, 'no participants: mark them data-who, as direct children of the container');
  }
  return new SequenceLayout(box, participants, { number, activations }, problems).run();
}

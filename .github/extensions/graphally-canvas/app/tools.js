// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The toolbar: connect the selected box to the next box picked, and relabel, re-side or delete
// the selected line. Each is one edit, sent to the canvas, which writes the file.
const SIDES = ['', 'top', 'right', 'bottom', 'left'];

// A line drawn but not in the diagram's JSON connections: from a list statement or a script.
const NOT_EDITABLE = 'This line comes from a list of sources or targets, or from a drawing script: '
  + 'edit it in the source.';

export class Tools {
  constructor(document, { edit, setStatus }) {
    const byId = id => document.getElementById(id);
    const controls = { label: byId('label'), connect: byId('connect'), relabel: byId('relabel') };
    Object.assign(controls, { out: byId('out'), in: byId('in'), remove: byId('remove') });
    Object.assign(this, { controls, edit, setStatus, item: null, line: null, connecting: null });
    const options = () => SIDES.map(side => new Option(side || 'auto', side));
    for (const select of [controls.out, controls.in]) select.append(...options());
    this.wire();
  }

  wire() {
    const { connect, relabel, out, remove, label } = this.controls;
    connect.addEventListener('click', () => this.startConnecting());
    relabel.addEventListener('click', () => this.setLine({ label: label.value.trim() || null }));
    out.addEventListener('change', () => this.setLine({ out: out.value || null }));
    this.controls.in.addEventListener('change', () => this.setLine({ in: this.controls.in.value || null }));
    remove.addEventListener('click', () => this.removeLine());
  }

  // The controls for what is selected, filled from the diagram's connections.
  update(lines, item) {
    this.item = item;
    this.line = item?.kind === 'line' ? lines.find(line => line.key === item.id) || null : null;
    const { connect, relabel, out, remove, label } = this.controls;
    connect.disabled = item?.kind !== 'box';
    for (const control of [relabel, out, this.controls.in, remove]) control.disabled = !this.line;
    if (item?.kind === 'line' && !this.line) this.setStatus(NOT_EDITABLE);
    if (!this.line) return;
    label.value = this.line.label || '';
    out.value = this.line.out || '';
    this.controls.in.value = this.line.in || '';
  }

  startConnecting() {
    this.connecting = this.item.id;
    this.controls.connect.classList.add('active');
    this.setStatus(`Click the box to connect ${this.connecting} to (Esc cancels).`);
  }

  // A box picked while connecting is the new line's target: true when it was taken that way.
  pick(item) {
    if (!this.connecting) return false;
    const from = this.connecting, label = this.controls.label.value.trim();
    this.cancel();
    if (item?.kind !== 'box' || item.id === from) return true;
    this.edit([{ op: 'connect', from, to: item.id, ...(label ? { label } : {}) }]);
    return true;
  }

  cancel() {
    this.connecting = null;
    this.controls.connect.classList.remove('active');
    this.setStatus('');
  }

  setLine(set) {
    if (this.line) this.edit([{ op: 'line', key: this.line.key, set }]);
  }

  removeLine() {
    if (this.line) this.edit([{ op: 'unline', key: this.line.key }]);
  }
}

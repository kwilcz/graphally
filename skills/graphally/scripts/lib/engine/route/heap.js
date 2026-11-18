// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.

// A binary min-heap of (key, value) pairs in two typed arrays, so a push allocates nothing.
// pop() returns the value and leaves its key in .key. Equal keys come out in the same order as
// from any heap that sifts the same way, which keeps routes the same.
export class Heap {
  constructor() {
    this.keys = new Float64Array(1024);
    this.values = new Int32Array(1024);
    this.size = 0;
    this.key = 0;
  }

  clear() { this.size = 0; }

  push(key, value) {
    if (this.size === this.keys.length) this.grow();
    const { keys, values } = this;
    let index = this.size++;
    keys[index] = key;
    values[index] = value;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (keys[parent] <= keys[index]) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  pop() {
    const { keys, values } = this, value = values[0];
    this.key = keys[0];
    const size = --this.size;
    if (size === 0) return value;
    keys[0] = keys[size];
    values[0] = values[size];
    for (let index = 0; ;) {
      const left = 2 * index + 1, right = left + 1;
      let smallest = index;
      if (left < size && keys[left] < keys[smallest]) smallest = left;
      if (right < size && keys[right] < keys[smallest]) smallest = right;
      if (smallest === index) break;
      this.swap(smallest, index);
      index = smallest;
    }
    return value;
  }

  swap(a, b) {
    const { keys, values } = this;
    const key = keys[a], value = values[a];
    keys[a] = keys[b];
    keys[b] = key;
    values[a] = values[b];
    values[b] = value;
  }

  grow() {
    const keys = new Float64Array(this.size * 2), values = new Int32Array(this.size * 2);
    keys.set(this.keys);
    values.set(this.values);
    this.keys = keys;
    this.values = values;
  }
}

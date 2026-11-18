// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The DevTools protocol over the browser's pipe: JSON messages ended by a NUL. A message with an
// id answers a call; any other is an event for the listeners.
import { StringDecoder } from 'node:string_decoder';

export class DevtoolsPipe {
  constructor(output, input) {
    this.output = output;
    this.pending = new Map();
    this.listeners = [];
    this.decoder = new StringDecoder('utf8');
    this.buffer = '';
    this.nextId = 0;
    this.dead = null;
    input.on('data', chunk => this.receive(chunk));
    output.on('error', () => {});
  }

  receive(chunk) {
    this.buffer += this.decoder.write(chunk);
    for (let end = this.buffer.indexOf('\0'); end >= 0; end = this.buffer.indexOf('\0')) {
      const message = JSON.parse(this.buffer.slice(0, end));
      this.buffer = this.buffer.slice(end + 1);
      this.dispatch(message);
    }
  }

  dispatch(message) {
    const call = message.id && this.pending.get(message.id);
    if (!call) {
      this.listeners.forEach(listener => listener(message));
      return;
    }
    this.pending.delete(message.id);
    if (message.error) call.reject(new Error(message.error.message));
    else call.resolve(message.result);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      if (this.dead) return reject(this.dead);
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.output.write(`${JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params })}\0`);
      return undefined;
    });
  }

  on(listener) { this.listeners.push(listener); }

  // Every call waiting, and every call after, fails with the error.
  fail(error) {
    this.dead = error;
    for (const call of this.pending.values()) call.reject(error);
    this.pending.clear();
  }
}

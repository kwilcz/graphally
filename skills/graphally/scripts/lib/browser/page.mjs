// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// A page of the browser: navigated, measured and captured over the DevTools protocol.
const ANSWER_WITHIN = 60000;

// A promise that fails with the message when the time runs out first.
function withTimeout(promise, timeout, message) {
  let timer;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeout);
    timer.unref?.();
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

// The message of an exception thrown in the page.
const exceptionMessage = details => details.exception?.description || details.text;

class Page {
  constructor(browser, targetId, sessionId, scale) {
    Object.assign(this, { browser, targetId, sessionId, scale, errors: [] });
    this.waitForReady();
  }

  // A call that gets no answer within a minute fails, so a stuck page ends the render with an
  // error instead of hanging it.
  call(method, params) {
    const answer = this.browser.send(method, params, this.sessionId);
    return withTimeout(answer, ANSWER_WITHIN, `the browser did not answer ${method} within 60 s`);
  }

  // A page signals that it is done by calling graphallyReady(): the event arrives here, with no
  // polling. A navigation starts a new wait.
  waitForReady() { this.readied = new Promise(resolve => { this.markReady = resolve; }); }

  listen(message) {
    if (message.sessionId !== this.sessionId) return;
    const { method, params } = message;
    if (method === 'Runtime.exceptionThrown') this.errors.push(exceptionMessage(params.exceptionDetails));
    else if (method === 'Runtime.bindingCalled' && params.name === 'graphallyReady') this.markReady(params.payload);
  }

  async setUp(width, height) {
    await this.call('Page.enable');
    await this.call('Runtime.enable');
    await this.call('Runtime.addBinding', { name: 'graphallyReady' });
    this.windowId = (await this.browser.send('Browser.getWindowForTarget', { targetId: this.targetId })).windowId;
    await this.viewport(width, height);
    // A capture is the still figure: a diagram's motion (flow, steps) plays only where the reader
    // allows motion, so the page asks for none.
    await this.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }

  // The window holds the whole page it shows. Headless windows open at 780×580, of which the
  // browser's own frame takes a strip (166 to 192px of the height, varying), and a capture
  // reaching beyond what the window draws now and then repeated what was inside it: a PNG with
  // the figure drawn a second time from x = 780, or from partway down. So the window is the
  // page with room to spare for any frame, in device pixels: at scale 2 the window needs twice
  // the page, or a 2x capture repeats its first half in the second.
  async viewport(width, height, scale = this.scale) {
    const bounds = { width: Math.ceil(width * scale) + 64, height: Math.ceil(height * scale) + 320 };
    await this.browser.send('Browser.setWindowBounds', { windowId: this.windowId, bounds });
    const metrics = { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: scale, mobile: false };
    return this.call('Emulation.setDeviceMetricsOverride', metrics);
  }

  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(exceptionMessage(result.exceptionDetails));
    return result.result.value;
  }

  goto(url) {
    this.errors.length = 0;
    this.waitForReady();
    return this.call('Page.navigate', { url });
  }

  // Resolves when the page calls graphallyReady() after the last goto.
  ready(timeout = ANSWER_WITHIN) { return withTimeout(this.readied, timeout, 'timed out waiting for the page'); }

  async waitFor(expression, timeout = ANSWER_WITHIN) {
    for (const end = Date.now() + timeout; Date.now() < end;) {
      if (await this.evaluate(expression).catch(() => false)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('timed out waiting for the page');
  }

  // fast: a quicker PNG encoding, about a third faster and a third larger, for previews.
  async screenshot(clip, { fast = false } = {}) {
    const options = {
      format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true,
      ...(fast ? { optimizeForSpeed: true } : {}),
    };
    const { data } = await this.call('Page.captureScreenshot', options);
    return Buffer.from(data, 'base64');
  }
}

// The target id of a blank page in a window of its own.
async function openWindowTarget(browser) {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', newWindow: true });
  return targetId;
}

// Each page beyond the first gets a window of its own, so none sits behind another.
export async function openPage(browser, { width = 1400, height = 900, scale = 1 } = {}) {
  const targetId = browser.takeSpare?.() || (await openWindowTarget(browser));
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const page = new Page(browser, targetId, sessionId, scale);
  browser.on(message => page.listen(message));
  await page.setUp(width, height);
  return page;
}

// ==UserScript==
// @name         Echo360 Static Global Style Fix
// @namespace    local.echo360.performance
// @version      0.3.0
// @license      MIT
// @homepageURL  https://github.com/shoebillback/echo360-performance-fix
// @supportURL   https://github.com/shoebillback/echo360-performance-fix/issues
// @downloadURL  https://raw.githubusercontent.com/shoebillback/echo360-performance-fix/main/echo360-static-global-style-fix.user.js
// @updateURL    https://raw.githubusercontent.com/shoebillback/echo360-performance-fix/main/echo360-static-global-style-fix.user.js
// @description  Reuse Echo360's unchanged static global stylesheet instead of parsing and reinserting it on every render.
// @match        https://echo360.org.uk/lesson/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  if (window.Echo360GlobalStyleFix) return;

  // Verified against the module source embedded in the supplied Chrome trace.
  // This is the application's global normalize/font-face/reset stylesheet.
  const MODULE_ID = 867;
  const factories = new WeakSet();
  const arrays = new WeakSet();
  const wrappers = new WeakSet();
  const stats = { factoryPatched: 0, stylePatched: 0,
    requests: 0, skipped: 0, rebuilds: 0, errors: 0 };
  let enabled = true;
  let styleId = null;
  const log = (...args) => console.info('[Echo360 Global Fix 0.3.0]', ...args);
  const warn = error => {
    stats.errors++;
    console.warn('[Echo360 Global Fix 0.3.0]', error);
  };

  function patchStyle(component) {
    const style = component && component.globalStyle;
    if (!style || style.isStatic !== true ||
        typeof style.renderStyles !== 'function' ||
        typeof style.removeStyles !== 'function' ||
        typeof style.componentId !== 'string') {
      throw new Error('Expected static global style not found; left unchanged.');
    }
    const render = style.renderStyles;
    const remove = style.removeStyles;
    const renderedSheets = new WeakSet();
    style.removeStyles = function (sheet) {
      if (this === style && sheet && typeof sheet === 'object') {
        renderedSheets.delete(sheet);
      }
      return Reflect.apply(remove, this, arguments);
    };
    style.renderStyles = function (props, sheet) {
      // Other instances and unknown stylesheet implementations use original behavior.
      if (this !== style || !sheet || typeof sheet !== 'object' ||
          typeof sheet.hasId !== 'function') {
        return Reflect.apply(render, this, arguments);
      }
      stats.requests++;
      if (enabled && this.isStatic === true && renderedSheets.has(sheet) &&
          sheet.hasId(this.componentId)) {
        stats.skipped++;
        return;
      }
      const result = Reflect.apply(render, this, arguments);
      stats.rebuilds++;
      // Mark only after successful rendering. Removal and unmount invalidate this.
      renderedSheets.add(sheet);
      return result;
    };
    styleId = style.componentId;
    stats.stylePatched++;
    log('Static global stylesheet patched:', styleId);
  }

  function inspect(chunk) {
    if (!Array.isArray(chunk) || !chunk[1]) return;
    const modules = chunk[1];
    if (!Object.prototype.hasOwnProperty.call(modules, MODULE_ID)) return;
    const original = modules[MODULE_ID];
    if (typeof original !== 'function' || factories.has(original)) return;
    factories.add(original);
    const source = Function.prototype.toString.call(original);
    if (!['createGlobalStyle', 'normalize', 'fontFace', 'Proxima Nova']
      .every(text => source.includes(text))) {
      log('Module 867 changed; skipped.');
      return;
    }
    function patched(module) {
      const result = Reflect.apply(original, this, arguments);
      try { patchStyle(module.exports.default); } catch (error) { warn(error); }
      return result;
    }
    factories.add(patched);
    try {
      modules[MODULE_ID] = patched;
      if (modules[MODULE_ID] !== patched) throw new Error('Module is read-only.');
      stats.factoryPatched++;
    } catch (error) { warn(error); }
  }

  function wrapPush(delegate) {
    if (typeof delegate !== 'function' || wrappers.has(delegate)) return delegate;
    // Capture a fixed delegate: Webpack saves the previous push during startup.
    function wrapped(...chunks) {
      for (const chunk of chunks) {
        try { inspect(chunk); } catch (error) { warn(error); }
      }
      return Reflect.apply(delegate, this, chunks);
    }
    wrappers.add(wrapped);
    return wrapped;
  }

  function watch(value) {
    if (!Array.isArray(value) || arrays.has(value)) return value;
    arrays.add(value);
    for (const chunk of value) {
      try { inspect(chunk); } catch (error) { warn(error); }
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, 'push');
    if (descriptor && !descriptor.configurable) {
      log('Chunk array cannot be watched; future chunks left unchanged.');
      return value;
    }
    let push = wrapPush(value.push);
    Object.defineProperty(value, 'push', {
      configurable: true, enumerable: false,
      get: () => push,
      set: next => { push = wrapPush(next); }
    });
    return value;
  }

  window.Echo360GlobalStyleFix = Object.freeze({
    status() {
      const result = { enabled, styleId, ...stats };
      console.table([result]);
      return result;
    },
    enable() { enabled = true; log('Enabled.'); },
    disable() { enabled = false; log('Original global-style rendering restored.'); },
    async test(seconds = 15) {
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120) {
        throw new RangeError('Duration must be 1..120 seconds.');
      }
      const start = { ...stats };
      const startEnabled = enabled;
      const started = performance.now();
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      const result = { mode: startEnabled ? 'ON' : 'OFF',
        modeChanged: enabled !== startEnabled,
        elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)),
        requests: stats.requests - start.requests,
        skipped: stats.skipped - start.skipped,
        rebuilds: stats.rebuilds - start.rebuilds };
      console.table([result]);
      return result;
    }
  });

  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'webpackJsonp');
    if (descriptor && !descriptor.configurable) {
      watch(window.webpackJsonp);
    } else {
      let value = watch(window.webpackJsonp);
      Object.defineProperty(window, 'webpackJsonp', {
        configurable: true, enumerable: true,
        get: () => value,
        set: next => { value = watch(next); }
      });
    }
  } catch (error) { warn(error); }
  log('Installed. After loading, run Echo360GlobalStyleFix.status().');
})();

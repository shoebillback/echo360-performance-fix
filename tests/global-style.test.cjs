const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname,
  '../echo360-static-global-style-fix.user.js'), 'utf8');

function setup(mode, { staticStyle = true, matches = true } = {}) {
  let rebuilds = 0;
  const style = {
    componentId: 'sc-global-fixture', isStatic: staticStyle,
    removeStyles(sheet) { sheet.remove(this.componentId); },
    renderStyles(props, sheet) {
      this.removeStyles(sheet);
      rebuilds++;
      sheet.inject(this.componentId);
    }
  };
  function factory(module) {
    void 'createGlobalStyle normalize fontFace Proxima Nova';
    module.exports = { default: { globalStyle: style } };
  }
  const actual = matches ? factory : function (module) { module.exports = {}; };
  const chunk = [[38], { 867: actual }];
  const window = {};
  let calls = 0;
  function load(ch) {
    calls++;
    ch[1][867]({ exports: {} });
  }
  if (mode === 'queued') window.webpackJsonp = [chunk];
  if (mode === 'runtime-first') {
    window.webpackJsonp = [];
    window.webpackJsonp.push = load;
  }
  vm.runInNewContext(source, {
    window, console: { info() {}, warn() {}, table() {} }, performance, setTimeout
  });
  if (mode === 'runtime-first') window.webpackJsonp.push(chunk);
  else {
    const array = window.webpackJsonp = window.webpackJsonp || [];
    const prior = array.push.bind(array);
    array.push = function (ch) { load(ch); return prior(ch); };
    if (mode === 'queued') for (const ch of array.slice()) array.push(ch);
    else array.push(chunk);
  }
  return { style, api: window.Echo360GlobalStyleFix,
    builds: () => rebuilds, calls: () => calls };
}

function makeSheet() {
  return {
    ids: new Set(),
    hasId(id) { return this.ids.has(id); },
    remove(id) { this.ids.delete(id); },
    inject(id) { this.ids.add(id); }
  };
}

for (const mode of ['runtime-after', 'queued', 'runtime-first']) {
  test(`${mode}: no loader recursion; static reuse and lifecycle`, () => {
    const { style, api, builds, calls } = setup(mode);
    assert.equal(calls(), 1);
    assert.equal(api.status().stylePatched, 1);
    const sheet = makeSheet();
    for (let i = 0; i < 101; i++) style.renderStyles({}, sheet);
    assert.equal(builds(), 1);
    assert.equal(api.status().skipped, 100);
    style.removeStyles(sheet);
    style.renderStyles({}, sheet);
    assert.equal(builds(), 2, 'remount must rebuild');
    sheet.ids.clear();
    style.renderStyles({}, sheet);
    assert.equal(builds(), 3, 'missing style ID must rebuild');
    style.renderStyles({}, makeSheet());
    assert.equal(builds(), 4, 'a separate stylesheet must render');
    api.disable();
    style.renderStyles({}, sheet);
    style.renderStyles({}, sheet);
    assert.equal(builds(), 6, 'disabled fix must use original rendering');
    api.enable();
    style.renderStyles({}, sheet);
    assert.equal(builds(), 6);
    style.isStatic = false;
    style.renderStyles({}, sheet);
    assert.equal(builds(), 7, 'dynamic styles must not be skipped');
  });
}

test('changed module signature is left untouched', () => {
  const { api, calls } = setup('runtime-after', { matches: false });
  assert.equal(calls(), 1);
  assert.equal(api.status().factoryPatched, 0);
});

test('non-static style export is left untouched', () => {
  const { api, style, builds } = setup('runtime-after', { staticStyle: false });
  assert.equal(api.status().stylePatched, 0);
  assert.equal(api.status().errors, 1);
  const sheet = makeSheet();
  style.renderStyles({}, sheet);
  style.renderStyles({}, sheet);
  assert.equal(builds(), 2);
});

test('failed rendering is retried instead of being cached', () => {
  const { style } = setup('runtime-after');
  const sheet = makeSheet();
  sheet.inject = () => { throw new Error('fixture failure'); };
  assert.throws(() => style.renderStyles({}, sheet), /fixture failure/);
  sheet.inject = function (id) { this.ids.add(id); };
  style.renderStyles({}, sheet);
  assert.equal(sheet.hasId(style.componentId), true);
});

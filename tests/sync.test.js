import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as model from '../docs/model.js';

const source = (await readFile(new URL('../docs/app.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const route = id => ({ id, scene: 'gym', place: 'Mellow', area: '', grade: '5.10d', feature: '', color: 'black', length: null, setter: '', photos: [], target: 'auto', projectStatus: '' });
const log = id => ({ id, routeId: id, date: '2026-11-09', createdAt: 1, updatedAt: 1, method: 'auto', result: 'send', style: 'redpoint', feel: 'Moderate', belayer: '', notes: '' });
const dataset = (...ids) => ({ routes: ids.map(route), logs: ids.map(log), meta: {} });
async function syncPage() {
  let current = dataset('local'), failWrite = false;
  const writes = [], handlers = {}, elements = new Map();
  const get = selector => {
    if (!elements.has(selector)) elements.set(selector, { textContent: '', open: false, showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(selector);
  };
  const toast = { classList: { add() {}, remove() {} }, textContent: '' };
  const app = { addEventListener(type, fn) { handlers[type] = fn; }, querySelector: get, innerHTML: '' };
  const deps = { ...model, icon: () => '',
    document: { querySelector: selector => selector === '#app' ? app : toast },
    window: { addEventListener() {} }, location: { hash: '#sync' }, navigator: {}, setTimeout() {}, clearTimeout() {},
    readAll: async () => structuredClone(current),
    write: async ({ routes = [], logs = [], meta = {} }) => {
      if (failWrite) throw new Error('Unable to save your climbing log.');
      writes.push({ routes, logs });
      current = { ...model.mergeBackup(current, { routes, logs }), meta: { ...current.meta, ...meta } };
    },
  };
  const api = await new AsyncFunction(...Object.keys(deps), `${source}\nreturn { importBackup, confirmImport };`)(...Object.values(deps));
  return { ...api, get, writes, toast,
    data: () => structuredClone(current),
    setData(data) { current = data; },
    failWrites() { failWrite = true; },
    cancel() { handlers.click({ target: { closest: () => ({ dataset: { action: 'cancel-import' } }) } }); },
    import(data) { return api.importBackup({ files: [{ text: async () => typeof data === 'string' ? data : JSON.stringify(model.makeBackup(data.routes, data.logs)) }], value: 'file' }); },
  };
}

test('导入只做预览，取消不写入；确认才添加新记录并保留本地编辑', async () => {
  const page = await syncPage(), incoming = dataset('local', 'new');
  incoming.logs[0].notes = 'backup edit';
  await page.import(incoming);
  assert.match(page.get('#import-summary').textContent, /1 new climbs, 0 duplicates, 1 conflicting climbs/);
  assert.equal(page.get('#import-confirm').open, true);
  assert.equal(page.writes.length, 0);
  page.cancel();
  assert.equal(page.get('#import-confirm').open, false);
  await page.confirmImport({ disabled: false });
  assert.equal(page.writes.length, 0);
  await page.import(incoming);
  await page.confirmImport({ disabled: false });
  assert.equal(page.data().logs.length, 2);
  assert.equal(page.data().logs[0].notes, '');
  assert.deepEqual(page.writes[0].logs.map(row => row.id), ['new']);
  assert.match(page.get('#sync-feedback').textContent, /1 climbs added/);
  await page.import(page.data());
  assert.match(page.get('#import-summary').textContent, /0 new climbs, 2 duplicates/);
});

test('预览后另一个标签页保存的数据，在确认时重新读取并保留', async () => {
  const page = await syncPage();
  await page.import(dataset('new'));
  const changed = dataset('local', 'new');
  changed.logs[1].notes = 'saved after preview';
  page.setData(changed);
  await page.confirmImport({ disabled: false });
  assert.equal(page.data().logs[1].notes, 'saved after preview');
  assert.equal(page.writes[0].logs.length, 0);
  assert.match(page.get('#sync-feedback').textContent, /0 climbs added/);
});

test('无效 JSON、无效备份和写入失败均提示错误，不改变记录', async () => {
  const page = await syncPage(), original = page.data();
  await page.import('{broken');
  assert.match(page.get('#sync-feedback').textContent, /not a valid JSON/);
  await page.import('{"app":"other"}');
  assert.match(page.get('#sync-feedback').textContent, /not a supported/);
  assert.equal(page.writes.length, 0);
  await page.import(dataset('new'));
  page.failWrites();
  const button = { disabled: false };
  await page.confirmImport(button);
  assert.equal(button.disabled, false);
  assert.equal(page.get('#import-confirm').open, true);
  assert.match(page.get('#import-error').textContent, /Unable to save/);
  assert.deepEqual(page.data(), original);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { File } from 'node:buffer';
import * as model from '../docs/model.js';

const source = (await readFile(new URL('../docs/app.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const route = id => ({ id, scene: 'gym', place: 'Mellow', area: '', grade: '5.10d', feature: '', color: 'black', length: null, setter: '', photos: [], target: 'auto', projectStatus: '' });
const log = id => ({ id, routeId: id, date: '2026-11-09', createdAt: 1, updatedAt: 1, method: 'auto', result: 'send', style: 'redpoint', feel: 'Moderate', belayer: '', notes: '' });
async function exporter({ sharing = false, shareError } = {}) {
  let current = { routes: [route('old')], logs: [log('old')] }, fail = false;
  const downloaded = [], shared = [];
  const app = { addEventListener() {}, innerHTML: '' };
  const toast = { classList: { add() {}, remove() {} }, textContent: '' };
  const deps = { ...model, File, icon: () => '', downloaded,
    document: { querySelector: selector => selector === '#app' ? app : toast },
    window: { addEventListener() {} }, location: { hash: '#sync' },
    navigator: { canShare: () => sharing, share: async ({ files }) => {
      if (shareError) throw shareError;
      shared.push(...files);
    } },
    setTimeout() {}, clearTimeout() {},
    readAll: async () => { if (fail) throw new Error('Read failed'); return structuredClone(current); },
  };
  const api = await new AsyncFunction(...Object.keys(deps), `${source}\ndownloadBackup = file => downloaded.push(file); return { exportData };`)(...Object.values(deps));
  return { ...api, downloaded, shared, toast,
    setData(data) { current = data; },
    failReads() { fail = true; },
  };
}

test('打开页面后另一标签页的新增、编辑和删除都反映在导出快照中', async () => {
  const page = await exporter();
  const current = { routes: [{ ...route('edited'), color: 'pink' }, route('added')], logs: [{ ...log('edited'), notes: '最新修改', updatedAt: 2 }, log('added')] };
  page.setData(current);
  await page.exportData();
  const backup = JSON.parse(await page.downloaded[0].text());
  assert.deepEqual(model.validateBackup(backup), current);
  assert.equal(backup.logs.some(item => item.id === 'old'), false);
  page.setData({ routes: [], logs: [] });
  await page.exportData();
  assert.deepEqual(model.validateBackup(JSON.parse(await page.downloaded[1].text())), { routes: [], logs: [] });
});

test('读取最新记录失败时提示错误，不用页面旧数据生成备份', async () => {
  const page = await exporter({ sharing: true });
  page.failReads();
  await page.exportData();
  assert.equal(page.downloaded.length, 0);
  assert.equal(page.shared.length, 0);
  assert.match(page.toast.textContent, /Unable to read the latest records/);
});

test('系统分享使用最新快照，分享不可用时下载的也是该快照', async () => {
  const data = { routes: [route('new')], logs: [log('new')] };
  const shared = await exporter({ sharing: true });
  shared.setData(data);
  await shared.exportData();
  assert.deepEqual(model.validateBackup(JSON.parse(await shared.shared[0].text())), data);
  const fallback = await exporter({ sharing: true, shareError: Object.assign(new Error('No activation'), { name: 'NotAllowedError' }) });
  fallback.setData(data);
  await fallback.exportData();
  assert.deepEqual(model.validateBackup(JSON.parse(await fallback.downloaded[0].text())), data);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import * as model from '../docs/model.js';

const source = (await readFile(new URL('../docs/app.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const route = { id: 'old-route', scene: 'outdoor', place: 'Old Gym', area: 'Old Area', grade: '5.9+', feature: 'Old Feature', color: '', length: 15, setter: 'Setter', photos: [], target: 'lead', projectStatus: 'stopped' };
const log = { id: 'old-log', routeId: route.id, date: '2026-10-29', createdAt: 0, updatedAt: 0, method: 'toprope', result: 'send', style: 'clean', feel: '', belayer: 'Belayer', notes: 'Old Notes' };

async function editor(routeValue = route, logValue = log, isNew = false) {
  let data = { routes: [structuredClone(routeValue)], logs: [structuredClone(logValue)] };
  let form;
  const app = {
    addEventListener() {},
    set innerHTML(html) {
      if (!html.includes('id="climb-form"')) return;
      const fields = {};
      for (const [, name, body] of html.matchAll(/<select name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
        const options = [...body.matchAll(/<option value="([^"]*)"\s*([^>]*)>([^<]*)<\/option>/g)];
        const selected = options.find(option => option[2].includes('selected')) || options[0];
        fields[name] = { value: selected[1], style: {}, options: options.map(option => option[1]) };
      }
      fields.date = { value: html.match(/name="date"[^>]*value="([^"]*)"/)[1] };
      form = { dataset: { id: html.match(/class="form" data-id="([^"]*)"/)[1] }, fields };
    },
    querySelector(selector) {
      if (selector === '#climb-form') return form;
      return form.fields.color;
    },
  };
  const toast = { classList: { add() {}, remove() {} } };
  const deps = { ...model, icon: () => '', crypto: webcrypto,
    document: { querySelector: selector => selector === '#app' ? app : toast },
    window: { addEventListener() {} }, location: { hash: '#home' }, navigator: {},
    clearTimeout() {}, setTimeout() {},
    FormData: class {
      constructor(formValue) { this.entries = Object.entries(formValue.fields).map(([name, field]) => [name, field.value]); }
      get(name) { return this.entries.find(([key]) => key === name)?.[1]; }
      [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    },
    readAll: async () => structuredClone(data),
    write: async ({ routes, logs }) => { data = { routes, logs }; },
  };
  const api = await new AsyncFunction(...Object.keys(deps), `${source}\nreturn { renderForm, saveForm };`)(...Object.values(deps));
  api.renderForm(isNew ? undefined : logValue.id);
  return {
    get form() { return form; },
    get data() { return data; },
    save: () => api.saveForm(form),
  };
}

test('打开旧记录只准备默认值，不写入记录；提交后才保存默认值', async () => {
  const page = await editor();
  assert.deepEqual(page.data, { routes: [route], logs: [log] });
  assert.equal(page.form.fields.color.value, 'black');
  assert.equal(page.form.fields.feel.value, 'Moderate');
  assert.equal(page.form.fields.outcome.value, 'redpoint');
  await page.save();
  assert.deepEqual(page.data.routes[0], { ...route, color: 'black' });
  assert.deepEqual({ ...page.data.logs[0], updatedAt: 0 }, { ...log, style: 'redpoint', feel: 'Moderate' });
  assert.deepEqual(model.validateBackup(JSON.parse(JSON.stringify(model.makeBackup(page.data.routes, page.data.logs)))), page.data);
});
test('表单完攀结果只使用当前设计的五项，不显示历史或空选项', async () => {
  for (const method of ['auto', 'toprope']) {
    for (const style of ['first', 'clean']) {
      const page = await editor(route, { ...log, method, style });
      assert.deepEqual(page.form.fields.outcome.options, ['onsight', 'flash', 'redpoint', 'repeat', 'attempt']);
      assert.equal(page.form.fields.outcome.value, 'redpoint');
      assert.equal(page.form.fields.color.options.includes(''), false);
      assert.equal(page.form.fields.feel.options.includes(''), false);
    }
  }
});
test('已有有效记录直接保存保持原值和隐藏字段', async () => {
  const savedRoute = { ...route, color: 'pink' };
  const savedLog = { ...log, style: 'flash', feel: 'Hard' };
  const page = await editor(savedRoute, savedLog);
  await page.save();
  assert.deepEqual(page.data.routes[0], savedRoute);
  assert.deepEqual({ ...page.data.logs[0], updatedAt: 0 }, savedLog);
});
test('用户调整值后才提交，重新打开显示提交的新值', async () => {
  const page = await editor();
  page.form.fields.color.value = 'pink';
  page.form.fields.feel.value = 'Hard';
  page.form.fields.outcome.value = 'flash';
  page.form.fields.date.value = '2026-10-30';
  assert.deepEqual(page.data, { routes: [route], logs: [log] });
  await page.save();
  const reopened = await editor(page.data.routes[0], page.data.logs[0]);
  assert.equal(reopened.form.fields.color.value, 'pink');
  assert.equal(reopened.form.fields.feel.value, 'Hard');
  assert.equal(reopened.form.fields.outcome.value, 'flash');
  assert.equal(reopened.form.fields.date.value, '2026-10-30');
});
test('新建表单八项都有默认值，直接提交即可形成完整记录', async () => {
  const page = await editor(route, log, true);
  const expected = { date: model.today(), place: 'Mellow', method: 'auto', color: 'black', grade: '5.10d', feel: 'Moderate', outcome: 'redpoint', project: 'no' };
  for (const [name, value] of Object.entries(expected)) assert.equal(page.form.fields[name].value, value, name);
  await page.save();
  assert.equal(page.data.routes[0].color, 'black');
  assert.equal(page.data.logs[0].feel, 'Moderate');
  assert.equal(page.data.logs[0].date, expected.date);
  assert.equal(page.data.logs[0].style, 'redpoint');
});
test('任何必填字段为空都拒绝保存且不写入记录', async () => {
  for (const name of ['date', 'place', 'method', 'color', 'grade', 'feel', 'outcome', 'project']) {
    const page = await editor(route, log, true);
    page.form.fields[name].value = '';
    await assert.rejects(page.save(), /Complete all fields/);
    assert.deepEqual(page.data, { routes: [route], logs: [log] });
  }
});
test('中文历史体感用当前英文选项显示，提交后使用当前值', async () => {
  for (const [old, current] of Object.entries({ 简单: 'Easy', 中等: 'Moderate', 偏难: 'Hard', 很硬: 'Very Hard' })) {
    const page = await editor(route, { ...log, feel: old });
    assert.equal(page.form.fields.feel.value, current);
    await page.save();
    assert.equal(page.data.logs[0].feel, current);
  }
});

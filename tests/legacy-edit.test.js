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

for (const method of ['auto', 'toprope']) {
  for (const style of ['first', 'clean']) {
    test(`旧 ${method}/${style} 记录直接保存保留原值和隐藏字段`, async () => {
      const oldLog = { ...log, method, style };
      const page = await editor(route, oldLog);
      assert.equal(page.form.fields.outcome.value, style);
      assert.equal(page.form.fields.color.value, '');
      assert.equal(page.form.fields.feel.value, '');
      await page.save();
      assert.deepEqual(page.data.routes[0], route);
      assert.deepEqual({ ...page.data.logs[0], updatedAt: 0 }, oldLog);
      assert.deepEqual(model.validateBackup(JSON.parse(JSON.stringify(model.makeBackup(page.data.routes, page.data.logs)))), page.data);
    });
  }
}
test('只修改旧记录日期，不改变颜色、完攀类型、体感和目标方式', async () => {
  const page = await editor();
  page.form.fields.date.value = '2026-10-30';
  await page.save();
  assert.deepEqual(page.data.routes[0], route);
  assert.deepEqual({ ...page.data.logs[0], updatedAt: 0 }, { ...log, date: '2026-10-30' });
});
test('中文历史体感显示对应选项，保存时保留原始值', async () => {
  for (const feel of ['简单', '中等', '偏难', '很硬']) {
    const page = await editor(route, { ...log, feel });
    assert.equal(page.form.fields.feel.value, feel);
    await page.save();
    assert.equal(page.data.logs[0].feel, feel);
  }
});
test('用户主动修改后保存新值，重新打开仍保持新值', async () => {
  const page = await editor();
  page.form.fields.color.value = 'pink';
  page.form.fields.feel.value = 'Hard';
  page.form.fields.outcome.value = 'redpoint';
  await page.save();
  const reopened = await editor(page.data.routes[0], page.data.logs[0]);
  assert.equal(reopened.form.fields.color.value, 'pink');
  assert.equal(reopened.form.fields.feel.value, 'Hard');
  assert.equal(reopened.form.fields.outcome.value, 'redpoint');
});
test('新增记录继续使用原默认值，不添加历史选项', async () => {
  const fresh = await editor(route, log, true);
  assert.equal(fresh.form.fields.place.value, 'Mellow');
  assert.equal(fresh.form.fields.color.value, 'black');
  assert.equal(fresh.form.fields.feel.value, 'Moderate');
  assert.equal(fresh.form.fields.outcome.value, 'redpoint');
  assert.equal(fresh.form.fields.outcome.options.includes('clean'), false);
  assert.equal(fresh.form.fields.color.options.includes(''), false);
  assert.equal(fresh.form.fields.feel.options.includes(''), false);
});

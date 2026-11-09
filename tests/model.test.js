import test from 'node:test';
import assert from 'node:assert/strict';
import { counts, completeProject, validateLog, validateRoute, validateBackup, makeBackup, mergeBackup, validDate, GRADES, COLORS, summarizeImport } from '../docs/model.js';
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=';
const route = () => ({ id: 'route-1', scene: 'gym', place: '测试岩馆', area: '', grade: '5.11a', feature: '大碗造型', color: 'blue', length: 15, setter: '', photos: [photo], target: 'lead', projectStatus: 'active' });
const log = (overrides = {}) => ({ id: 'log-1', routeId: 'route-1', date: '2026-10-29', createdAt: 1, updatedAt: 1, method: 'lead', result: 'attempt', style: '', feel: '偏难', belayer: '测试保护员', notes: '练习中', ...overrides });
test('次数包含成功上墙，按线路和方式分别统计', () => {
  const logs = [log(), log({ id: '2', result: 'send', style: 'redpoint' }), log({ id: '3', method: 'toprope', result: 'send', style: 'clean' }), log({ id: '4', routeId: 'other' })];
  assert.deepEqual(counts(logs, 'route-1'), { total: 3, sends: 2 });
  assert.deepEqual(counts(logs, 'route-1', 'lead'), { total: 2, sends: 1 });
});
test('只有目标方式的 Send 才完成 Project', () => {
  assert.equal(completeProject(route(), log()).projectStatus, 'active');
  assert.equal(completeProject(route(), log({ method: 'toprope', result: 'send', style: 'clean' })).projectStatus, 'active');
  assert.equal(completeProject(route(), log({ result: 'send', style: 'redpoint' })).projectStatus, 'complete');
  assert.equal(completeProject({ ...route(), projectStatus: 'stopped' }, log({ result: 'send', style: 'redpoint' })).projectStatus, 'stopped');
});
test('拒绝不存在的日期，允许闰日和补录', () => {
  assert.equal(validDate('2024-02-29'), true); assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-13-01'), false); assert.equal(validDate('2026-1-1'), false);
});
test('未成功时没有完攀类型，成功类型适用于所有绳索方式', () => {
  assert.deepEqual(validateLog(log()), log());
  assert.throws(() => validateLog(log({ style: 'onsight' })));
  assert.throws(() => validateLog(log({ result: 'send' })));
  assert.equal(validateLog(log({ method: 'toprope', result: 'send', style: 'redpoint' })).style, 'redpoint');
  assert.equal(validateLog(log({ method: 'toprope', result: 'send', style: 'clean' })).style, 'clean');
});
test('线路长度、难度和颜色需合法', () => {
  assert.equal(validateRoute(route()).length, 15);
  for (const bad of [{ length: -1 }, { length: Infinity }, { length: '15' }, { grade: '5.bad' }, { color: 'neon' }, { place: ' ' }]) assert.throws(() => validateRoute({ ...route(), ...bad }));
  assert.equal(validateRoute({ ...route(), color: 'cyan', grade: '5.10ab' }).grade, '5.10ab');
});
test('新难度列表从 5.10a 到 5.15d，包含双字母过渡级别', () => {
  assert.equal(GRADES[0], '5.10a');
  assert.equal(GRADES.at(-1), '5.15d');
  assert.ok(['5.10ab', '5.10bc', '5.10cd', '5.15ab'].every(grade => GRADES.includes(grade)));
});
test('完整备份往返保留照片、备注和 Project', () => {
  const data = { routes: [route()], logs: [log()] };
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(makeBackup(data.routes, data.logs)))), data);
});
test('导入拒绝孤立日志、重复标识和不支持的版本', () => {
  const backup = makeBackup([route()], [log()]);
  assert.throws(() => validateBackup({ ...backup, routes: [] }));
  assert.throws(() => validateBackup({ ...backup, logs: [log(), log()] }));
  assert.throws(() => validateBackup({ ...backup, routes: [route(), route()] }));
  assert.throws(() => validateBackup({ ...backup, version: 2 }));
  assert.throws(() => validateBackup(null));
});
test('拒绝脚本型照片及超过数量上限的照片', () => {
  assert.throws(() => validateRoute({ ...route(), photos: ['javascript:alert(1)'] }));
  assert.throws(() => validateRoute({ ...route(), photos: ['data:image/svg+xml;base64,PHN2Zz4='] }));
  assert.throws(() => validateRoute({ ...route(), photos: Array(5).fill(photo) }));
});
test('合并导入幂等，本机编辑优先保留', () => {
  const current = { routes: [{ ...route(), feature: '本机修改' }], logs: [{ ...log(), notes: '本机备注' }] };
  const incoming = { routes: [route(), { ...route(), id: 'route-2' }], logs: [log(), log({ id: 'log-2', routeId: 'route-2' })] };
  const merged = mergeBackup(current, incoming);
  assert.equal(merged.routes.length, 2); assert.equal(merged.logs.length, 2);
  assert.equal(merged.routes.find(r => r.id === 'route-1').feature, '本机修改');
  assert.equal(merged.logs.find(l => l.id === 'log-1').notes, '本机备注');
  assert.deepEqual(mergeBackup(merged, incoming), merged);
});
test('备份去除无关属性，用户文字仍保留为普通文字', () => {
  assert.equal(validateRoute({ ...route(), injected: 'extra' }).injected, undefined);
  assert.equal(validateLog(log({ notes: '<img src=x onerror=alert(1)>' })).notes, '<img src=x onerror=alert(1)>');
});

test('Pink Line 可保存并随旧颜色记录一起备份和导入', () => {
  const pinkRoute = validateRoute({ ...route(), id: 'pink-route', color: 'pink' });
  assert.equal(pinkRoute.color, 'pink');
  const data = { routes: [route(), pinkRoute], logs: [log(), log({ id: 'pink-log', routeId: 'pink-route' })] };
  const restored = validateBackup(JSON.parse(JSON.stringify(makeBackup(data.routes, data.logs))));
  assert.deepEqual(restored, data);
  assert.deepEqual(mergeBackup({ routes: [], logs: [] }, restored), data);
});

test('所有线路颜色在卡片和表单背景上达到 4.5:1 对比度', () => {
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255);
    const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  for (const [label, color] of Object.values(COLORS)) {
    for (const background of ['#ffffff', '#ededed']) {
      const ratio = (luminance(background) + 0.05) / (luminance(color) + 0.05);
      assert.ok(ratio >= 4.5, `${label} on ${background}: ${ratio}`);
    }
  }
});
test('所有线路颜色的备份往返保留原颜色标识', () => {
  const routes = Object.keys(COLORS).map(color => validateRoute({ ...route(), id: `route-${color}`, color }));
  const logs = routes.map(item => log({ id: `log-${item.color}`, routeId: item.id }));
  const restored = validateBackup(JSON.parse(JSON.stringify(makeBackup(routes, logs))));
  assert.deepEqual(restored, { routes, logs });
});

test('导入预览区分新增、相同副本和冲突，不改变任何输入', () => {
  const current = { routes: [route()], logs: [log()] };
  const incoming = { routes: [route(), { ...route(), id: 'r2' }], logs: [log(), log({ id: 'l2', routeId: 'r2' })] };
  const before = structuredClone({ current, incoming });
  assert.deepEqual(summarizeImport(current, incoming), { added: 1, duplicate: 1, conflict: 0, routeConflicts: 0 });
  assert.deepEqual({ current, incoming }, before);
  incoming.logs[0].notes = '其他设备编辑';
  assert.deepEqual(summarizeImport(current, incoming), { added: 1, duplicate: 0, conflict: 1, routeConflicts: 0 });
  incoming.routes[0].grade = '5.12a';
  assert.equal(summarizeImport(current, incoming).routeConflicts, 1);
});

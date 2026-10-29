export const METHODS = { lead: '先锋', toprope: '顶绳', auto: '自动保护器' };
export const SCENES = { gym: '岩馆', outdoor: '野外' };
export const COLORS = { red: ['红', '#c65d50'], orange: ['橙', '#d6934c'], yellow: ['黄', '#d6bc56'], green: ['绿', '#71966d'], blue: ['蓝', '#668fae'], purple: ['紫', '#94769f'], black: ['黑', '#414741'] };
export const STYLES = { lead: { onsight: 'Onsight', flash: 'Flash', redpoint: 'Redpoint', repeat: 'Repeat 重复完攀' }, toprope: { first: '首次无坠落完成', clean: '练习后无坠落完成', repeat: '重复完成' }, auto: { first: '首次无坠落完成', clean: '练习后无坠落完成', repeat: '重复完成' } };
export const PROJECTS = { active: '进行中', complete: '已完成', stopped: '已停止' };
export const FEELS = ['简单', '中等', '偏难', '很硬'];
export const GRADES = ['未知', ...Array.from({ length: 10 }, (_, i) => `5.${i}`), '5.9+', ...Array.from({ length: 6 }, (_, i) => [`5.${i + 10}`, `5.${i + 10}-`, ...'abcd'.split('').map(c => `5.${i + 10}${c}`), `5.${i + 10}+`]).flat()];
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const routeTitle = r => r.feature || `${r.color ? COLORS[r.color][0] + '色' : '未命名'}线路`;
export function counts(logs, routeId, method) {
  const rows = logs.filter(l => (!routeId || l.routeId === routeId) && (!method || l.method === method));
  return { total: rows.length, sends: rows.filter(l => l.result === 'send').length };
}
export function completeProject(route, log) {
  return route.projectStatus === 'active' && route.target === log.method && log.result === 'send' ? { ...route, projectStatus: 'complete' } : route;
}
const fail = message => { throw new Error(message); };
const text = (v, max, label, required = false) => { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`${label}格式不正确`); return v; };
const choice = (v, options, label) => { if (!options.includes(v)) fail(`${label}不在可选范围内`); return v; };
const id = v => text(v, 100, '标识', true);
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(v + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function validateRoute(r) {
  if (!r || typeof r !== 'object') fail('线路数据不正确');
  const result = { id: id(r.id), scene: choice(r.scene, Object.keys(SCENES), '场景'), place: text(r.place, 100, '地点', true), area: text(r.area, 100, '岩区'), grade: choice(r.grade, GRADES, '难度'), feature: text(r.feature, 150, '线路特征'), color: choice(r.color, ['', ...Object.keys(COLORS)], '颜色'), length: r.length, setter: text(r.setter, 100, '定线员'), target: choice(r.target, Object.keys(METHODS), '目标方式'), projectStatus: choice(r.projectStatus, ['', ...Object.keys(PROJECTS)], 'Project 状态') };
  if (r.length !== null && (typeof r.length !== 'number' || !Number.isFinite(r.length) || r.length <= 0 || r.length > 10000)) fail('线路长度不正确');
  if (!Array.isArray(r.photos) || r.photos.length > 4) fail('每条线路最多 4 张照片');
  result.photos = r.photos.map(p => {
    if (typeof p !== 'string' || p.length > 8 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p)) fail('照片格式不正确');
    return p;
  });
  return result;
}
export function validateLog(l) {
  if (!l || typeof l !== 'object') fail('日志数据不正确');
  if (!validDate(l.date)) fail('攀爬日期不正确');
  if (typeof l.createdAt !== 'number' || !Number.isFinite(l.createdAt) || l.createdAt < 0) fail('记录时间不正确');
  const method = choice(l.method, Object.keys(METHODS), '攀爬方式');
  const result = choice(l.result, ['send', 'attempt'], '结束状态');
  return { id: id(l.id), routeId: id(l.routeId), date: l.date, createdAt: l.createdAt, method, result, style: choice(l.style, result === 'send' ? Object.keys(STYLES[method]) : [''], '完攀类型'), feel: choice(l.feel, ['', ...FEELS], '体感'), belayer: text(l.belayer, 100, '保护员'), notes: text(l.notes, 5000, '备注') };
}
export function validateBackup(input) {
  if (!input || input.app !== 'climbing-log' || input.version !== 1 || !Array.isArray(input.routes) || !Array.isArray(input.logs)) fail('不是受支持的岩记备份文件');
  const routes = input.routes.map(validateRoute), logs = input.logs.map(validateLog);
  const routeIds = new Set(routes.map(r => r.id)), logIds = new Set(logs.map(l => l.id));
  if (routeIds.size !== routes.length || logIds.size !== logs.length) fail('备份内存在重复标识');
  if (logs.some(l => !routeIds.has(l.routeId))) fail('备份内有日志缺少对应线路');
  return { routes, logs };
}
export function makeBackup(routes, logs) { return { app: 'climbing-log', version: 1, exportedAt: new Date().toISOString(), routes, logs }; }
export function mergeBackup(current, incoming) {
  // Existing local records always win. Import never overwrites a newer local edit.
  return { routes: [...new Map([...incoming.routes, ...current.routes].map(r => [r.id, r])).values()], logs: [...new Map([...incoming.logs, ...current.logs].map(l => [l.id, l])).values()] };
}

export const METHODS = { auto: 'Auto Belay', toprope: 'Top Rope', lead: 'Lead' };
export const SCENES = { gym: '岩馆', outdoor: '野外' };
export const COLORS = { red: ['Red Line', '#c42b12'], orange: ['Orange Line', '#a45100'], yellow: ['Yellow Line', '#806400'], green: ['Green Line', '#007a00'], cyan: ['Cyan Line', '#00727d'], blue: ['Blue Line', '#173bd0'], purple: ['Purple Line', '#800080'], pink: ['Pink Line', '#c21875'], black: ['Black Line', '#222222'], white: ['White Line', '#666666'], ochre: ['Ochre Line', '#905a1c'], tiffany: ['Tiffany Blue Line', '#08736f'] };
export const STYLES = { lead: { onsight: 'Onsight', flash: 'Flash', redpoint: 'Redpoint', repeat: 'Repeat 重复完攀' }, toprope: { first: '首次无坠落完成', clean: '练习后无坠落完成', repeat: '重复完成' }, auto: { first: '首次无坠落完成', clean: '练习后无坠落完成', repeat: '重复完成' } };
export const PROJECTS = { active: '进行中', complete: '已完成', stopped: '已停止' };
export const FEELS = ['Easy', 'Moderate', 'Hard', 'Very Hard', '简单', '中等', '偏难', '很硬'];
export const GRADES = Array.from({ length: 6 }, (_, i) => ['a', 'ab', 'b', 'bc', 'c', 'cd', 'd'].map(suffix => `5.${i + 10}${suffix}`)).flat();
const LEGACY_GRADES = ['未知', ...Array.from({ length: 10 }, (_, i) => `5.${i}`), '5.9+', ...Array.from({ length: 6 }, (_, i) => [`5.${i + 10}`, `5.${i + 10}-`, `5.${i + 10}+`]).flat()];
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const routeTitle = r => r.feature || (r.color ? COLORS[r.color][0] : '未命名线路');
export function counts(logs, routeId, method) {
  const rows = logs.filter(l => (!routeId || l.routeId === routeId) && (!method || l.method === method));
  return { total: rows.length, sends: rows.filter(l => l.result === 'send').length };
}
export function completeProject(route, log) {
  return route.projectStatus === 'active' && route.target === log.method && log.result === 'send' ? { ...route, projectStatus: 'complete' } : route;
}
const fail = message => { throw new Error(message); };
const text = (v, max, label, required = false) => { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`${label} is invalid.`); return v; };
const choice = (v, options, label) => { if (!options.includes(v)) fail(`${label} is not a valid option.`); return v; };
const id = v => text(v, 100, 'Record ID', true);
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(v + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function validateRoute(r) {
  if (!r || typeof r !== 'object') fail('Route data is invalid.');
  const result = { id: id(r.id), scene: choice(r.scene, Object.keys(SCENES), 'Climbing scene'), place: text(r.place, 100, 'Location', true), area: text(r.area, 100, 'Climbing area'), grade: choice(r.grade, [...GRADES, ...LEGACY_GRADES], 'Grade'), feature: text(r.feature, 150, 'Route feature'), color: choice(r.color, ['', ...Object.keys(COLORS)], 'Line color'), length: r.length, setter: text(r.setter, 100, 'Route setter'), target: choice(r.target, Object.keys(METHODS), 'Target climbing style'), projectStatus: choice(r.projectStatus, ['', ...Object.keys(PROJECTS)], 'Project status') };
  if (r.length !== null && (typeof r.length !== 'number' || !Number.isFinite(r.length) || r.length <= 0 || r.length > 10000)) fail('Route length is invalid.');
  if (!Array.isArray(r.photos) || r.photos.length > 4) fail('Add no more than 4 route photos.');
  result.photos = r.photos.map(p => {
    if (typeof p !== 'string' || p.length > 8 * 1024 * 1024 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p)) fail('Use a valid JPEG, PNG, or WebP route photo.');
    return p;
  });
  return result;
}
export function validateLog(l) {
  if (!l || typeof l !== 'object') fail('Climb data is invalid.');
  if (!validDate(l.date)) fail('Climb date is invalid.');
  if (typeof l.createdAt !== 'number' || !Number.isFinite(l.createdAt) || l.createdAt < 0) fail('Record time is invalid.');
  const method = choice(l.method, Object.keys(METHODS), 'Climbing style');
  const result = choice(l.result, ['send', 'attempt'], 'Climb result');
  const updatedAt = l.updatedAt ?? l.createdAt;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) fail('Update time is invalid.');
  return { id: id(l.id), routeId: id(l.routeId), date: l.date, createdAt: l.createdAt, updatedAt, method, result, style: choice(l.style, result === 'send' ? [...Object.keys(STYLES[method]), 'onsight', 'flash', 'redpoint', 'repeat'] : [''], 'Send type'), feel: choice(l.feel, ['', ...FEELS], 'Perceived difficulty'), belayer: text(l.belayer, 100, 'Belayer'), notes: text(l.notes, 5000, 'Notes') };
}
export function validateBackup(input) {
  if (!input || input.app !== 'climbing-log' || input.version !== 1 || !Array.isArray(input.routes) || !Array.isArray(input.logs)) fail('This is not a supported Climbing Log backup file.');
  const routes = input.routes.map(validateRoute), logs = input.logs.map(validateLog);
  const routeIds = new Set(routes.map(r => r.id)), logIds = new Set(logs.map(l => l.id));
  if (routeIds.size !== routes.length || logIds.size !== logs.length) fail('The backup contains duplicate record IDs.');
  if (logs.some(l => !routeIds.has(l.routeId))) fail('A climb in the backup has no matching route.');
  return { routes, logs };
}
export function makeBackup(routes, logs) { return { app: 'climbing-log', version: 1, exportedAt: new Date().toISOString(), routes, logs }; }
export function mergeBackup(current, incoming) {
  // Existing local records always win. Import never overwrites a newer local edit.
  return { routes: [...new Map([...incoming.routes, ...current.routes].map(r => [r.id, r])).values()], logs: [...new Map([...incoming.logs, ...current.logs].map(l => [l.id, l])).values()] };
}

export function summarizeImport(current, incoming) {
  const routes = new Map(current.routes.map(route => [route.id, route]));
  const logs = new Map(current.logs.map(log => [log.id, log]));
  const same = (left, right, validate) => JSON.stringify(validate(left)) === JSON.stringify(validate(right));
  const summary = { added: 0, duplicate: 0, conflict: 0, routeConflicts: 0 };
  for (const route of incoming.routes) if (routes.has(route.id) && !same(routes.get(route.id), route, validateRoute)) summary.routeConflicts++;
  const incomingRoutes = new Map(incoming.routes.map(route => [route.id, route]));
  for (const log of incoming.logs) {
    const local = logs.get(log.id);
    if (!local) summary.added++;
    else if (same(local, log, validateLog) && (!routes.has(log.routeId) || same(routes.get(log.routeId), incomingRoutes.get(log.routeId), validateRoute))) summary.duplicate++;
    else summary.conflict++;
  }
  return summary;
}

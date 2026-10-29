import { METHODS, SCENES, COLORS, STYLES, PROJECTS, GRADES, today, routeTitle, counts, completeProject, validateRoute, validateLog, validateBackup, makeBackup, mergeBackup } from './model.js';
import { readAll, write } from './storage.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const form = $('#log-form'), field = name => form.elements.namedItem(name);
let state = { routes: [], logs: [], meta: {} }, editingId = null, photos = [], photoBusy = false, saving = false, toastTimer;
let filters = { query: '', scene: '', result: '' };
const routeOf = log => state.routes.find(r => r.id === log.routeId);
const sortedLogs = () => [...state.logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || b.id.localeCompare(a.id));
const dot = r => r.color ? `<i class="color-dot" style="background:${COLORS[r.color][1]}"></i>` : '';
const placeText = r => `${r.place}${r.area ? ' · ' + r.area : ''}`;
const mountain = '<svg viewBox="0 0 100 80" aria-hidden="true"><path d="m8 65 32-52 22 36 14-23 20 39H8Z"/><path d="m30 29 10 11 9-12M62 49l14 8 9-10"/><path d="M18 74h69M7 74h5"/></svg>';
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3500); }
function report(error) { console.error(error); toast(error.name === 'QuotaExceededError' ? '设备存储空间不足，请先导出备份并释放空间。' : error.message || '操作失败，请重试'); }
async function refresh() { state = await readAll(); render(); }
function pageName() { return ['logs', 'projects', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'logs'; }
function render() {
  const page = pageName();
  $$('[data-nav]').forEach(a => { a.classList.toggle('active', a.dataset.nav === page); if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (page === 'logs') renderLogs();
  if (page === 'projects') renderProjects();
  if (page === 'settings') renderSettings();
}
function renderLogs() {
  const all = counts(state.logs), days = new Set(state.logs.map(l => l.date)).size;
  $('#main').innerHTML = `<section class="hero"><div><span class="eyebrow">YOUR CLIMBING JOURNAL</span><h1>每一次上墙，都算数。</h1><p class="subtitle">记下尝试，也记下突破。</p></div><button class="primary add-button" data-action="add"><b aria-hidden="true">+</b>记录</button></section><section class="stats" aria-label="攀爬统计"><div class="stat"><strong>${all.total}</strong><span>累计上墙</span></div><div class="stat"><strong>${all.sends}</strong><span>Send 成功</span></div><div class="stat"><strong>${days}</strong><span>攀爬天数</span></div></section><div class="tools"><label class="search"><span class="sr-only" hidden>搜索线路或地点</span><input id="search" type="search" aria-label="搜索线路或地点" placeholder="搜索线路、地点或备注" value="${esc(filters.query)}"></label><select id="scene-filter" class="filter" aria-label="按场景筛选"><option value="">全部场景</option><option value="gym">岩馆</option><option value="outdoor">野外</option></select><select id="result-filter" class="filter" aria-label="按结果筛选"><option value="">全部结果</option><option value="send">Send</option><option value="attempt">Attempt</option></select></div><div id="log-results"></div><p class="privacy-note">记录保存在当前浏览器 · 记得定期导出备份</p>`;
  $('#scene-filter').value = filters.scene; $('#result-filter').value = filters.result;
  renderLogResults();
}
function renderLogResults() {
  const query = filters.query.toLocaleLowerCase().trim();
  const logs = sortedLogs().filter(l => { const r = routeOf(l); return r && (!filters.scene || r.scene === filters.scene) && (!filters.result || l.result === filters.result) && (!query || [r.feature, r.place, r.area, r.grade, l.notes, l.belayer].join(' ').toLocaleLowerCase().includes(query)); });
  $('#log-results').innerHTML = `<div class="section-label"><span>攀爬日志</span><span>${logs.length} 条记录</span></div>${logs.length ? `<div class="log-list">${logs.map(logCard).join('')}</div>` : `<div class="empty">${mountain}<h3>${state.logs.length ? '没有找到匹配的记录' : '从下一次攀爬开始'}</h3><p>${state.logs.length ? '试着换一个关键词或筛选条件。' : '无论成功还是尝试，都值得留下记录。<br>你的第一条攀爬日志，从这里开始。'}</p>${state.logs.length ? '<button class="secondary" data-action="reset-filters">清除筛选</button>' : '<button class="primary" data-action="add">记录第一次攀爬</button>'}</div>`}`;
}
function logCard(l) {
  const r = routeOf(l);
  return `<button class="log-card" data-action="detail" data-id="${esc(l.id)}"><span class="grade ${l.result}">${esc(r.grade)}</span><span class="card-text"><h3>${dot(r)}${esc(routeTitle(r))}</h3><span class="card-meta"><span>${esc(placeText(r))}</span><span>${esc(l.date)}</span><span>${METHODS[l.method]}</span>${l.feel ? `<span>${l.feel}</span>` : ''}</span><span class="result-tag ${l.result}">${l.result === 'send' ? `Send · ${STYLES[l.method][l.style]}` : 'Attempt 尝试'}</span></span><span class="card-arrow" aria-hidden="true">›</span></button>`;
}
function renderProjects() {
  const routes = state.routes.filter(r => r.projectStatus).sort((a, b) => (a.projectStatus === 'active' ? 0 : 1) - (b.projectStatus === 'active' ? 0 : 1));
  $('#main').innerHTML = `<section class="hero"><div><span class="eyebrow">WORKING TOWARD IT</span><h1>正在攻克的线路</h1><p class="subtitle">把每一次尝试，连成进步的轨迹。</p></div></section>${routes.length ? routes.map(r => { const c = counts(state.logs, r.id), target = counts(state.logs, r.id, r.target); return `<article class="project-card"><div class="project-top"><div><h3>${dot(r)}${esc(routeTitle(r))}</h3><p class="card-meta">${esc(placeText(r))} · 目标：${METHODS[r.target]}</p></div><strong>${esc(r.grade)}</strong></div><p class="project-progress">已记录 ${c.total} 次上墙 · 目标方式 ${target.total} 次尝试 / ${target.sends} 次成功</p><div class="project-bottom"><select data-project="${esc(r.id)}" aria-label="${esc(routeTitle(r))}的 Project 状态">${Object.entries(PROJECTS).map(([v, label]) => `<option value="${v}" ${r.projectStatus === v ? 'selected' : ''}>${label}</option>`).join('')}</select><button class="secondary" data-action="route-detail" data-id="${esc(r.id)}">历史</button><button class="primary" data-action="climb-route" data-id="${esc(r.id)}">再爬一次</button></div></article>`; }).join('') : `<div class="empty">${mountain}<h3>下一个突破，会是哪条？</h3><p>记录攀爬时，将想攻克的线路设为 Project，就能在这里追踪进度。</p><button class="primary" data-action="add">记录攀爬</button></div>`}`;
}
function renderSettings() {
  const photosCount = state.routes.reduce((n, r) => n + r.photos.length, 0);
  $('#main').innerHTML = `<section class="hero"><div><span class="eyebrow">YOURS, ON THIS DEVICE</span><h1>你的攀爬，你的数据。</h1><p class="subtitle">无需账号，记录留在当前浏览器。</p></div></section><section class="panel"><h3>备份与恢复</h3><p>当前保存 ${state.logs.length} 条日志、${state.routes.length} 条线路和 ${photosCount} 张照片。导出文件包含全部记录、Project 和照片，可用于换机或恢复。</p><div class="button-row"><button class="primary" data-action="export">导出完整备份</button><button class="secondary" data-action="import">导入备份</button></div><input id="backup-file" type="file" accept=".json,application/json" hidden><div class="backup-date">${state.meta.backupAt ? `上次导出：${esc(new Date(state.meta.backupAt).toLocaleString('zh-CN'))}` : '尚未导出备份'}</div><p class="hint">导入采用合并方式，同一标识的已有本机记录优先保留，不覆盖本机修改。</p></section><section class="panel"><h3>本机存储</h3><p>日志与照片使用浏览器本地存储。不同设备、浏览器或网站地址的数据独立。清除网站数据、使用无痕模式或浏览器回收空间，都可能导致记录丢失，请定期导出。</p><button class="secondary" data-action="persist">申请持久存储</button><p class="hint">由浏览器决定是否允许；即使获准，仍需自行备份。</p></section><section class="panel"><h3>记录规则</h3><p>一次上墙对应一条日志，成功的那次也计入尝试次数。Send 表示从起点到终点无坠落、无挂绳休息地完成；其他情况记为 Attempt。</p><p>计数仅统计已录入的日志。先锋、顶绳和自动保护器分别统计，完攀类型由你根据真实历史选择。岩馆换线后请建立新线路。</p></section><p class="privacy-note">岩记 · Climbing Log<br>个人绳索攀岩日志 / v1.0</p>`;
}
function updateConditional() {
  const outdoor = field('scene').value === 'outdoor';
  $('#place-label').textContent = outdoor ? '岩场名称' : '岩馆名称'; $('#area-label').hidden = !outdoor; $('#setter-label').hidden = outdoor;
  $('#belayer-label').hidden = field('method').value === 'auto';
  $('#project-options').hidden = !field('isProject').checked;
  const send = field('result').value === 'send'; $('#style-label').hidden = !send; field('style').required = send;
  const old = field('style').value;
  field('style').innerHTML = '<option value="">请选择</option>' + Object.entries(STYLES[field('method').value]).map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  field('style').value = Object.hasOwn(STYLES[field('method').value], old) ? old : '';
  $('#style-hint').textContent = field('method').value === 'lead' ? 'Onsight：首次、无动作信息；Flash：首次、已有动作信息；Redpoint：练习后的首次先锋成功；Repeat：再次先锋成功。' : '首次指此前从未尝试过这条线路，不是当天第一次。此前练过则选择“练习后无坠落完成”。';
}
function updateColors() { $$('.color-button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === field('color').value))); }
function renderPhotos() { $('#photo-preview').innerHTML = photos.map((src, i) => `<div class="photo-item"><img src="${src}" alt="线路照片 ${i + 1}"><button type="button" data-action="remove-photo" data-index="${i}" aria-label="移除照片 ${i + 1}">×</button></div>`).join(''); }
function fillRoute(route) {
  for (const name of ['scene', 'place', 'area', 'grade', 'feature', 'color', 'setter', 'target']) field(name).value = route?.[name] ?? ({ scene: 'gym', grade: '未知', target: field('method').value }[name] || '');
  field('length').value = route?.length ?? '';
  field('isProject').checked = Boolean(route?.projectStatus); field('projectStatus').value = route?.projectStatus || 'active';
  photos = [...(route?.photos || [])];
  $('#route-extras').open = Boolean(route?.photos.length || route?.length || route?.setter);
  updateColors(); renderPhotos(); updateConditional();
}
function openEditor({ logId, routeId } = {}) {
  form.reset(); editingId = logId || null; photos = [];
  $('#form-error').textContent = ''; $('#save-log').disabled = false; $('#save-log').textContent = '保存记录';
  $('#editor-title').textContent = logId ? '编辑攀爬记录' : '记录一次攀爬';
  const log = state.logs.find(l => l.id === logId);
  const last = sortedLogs()[0], lastRoute = last && routeOf(last);
  field('date').value = log?.date || today(); field('method').value = log?.method || (routeId ? state.routes.find(r => r.id === routeId)?.target : last?.method) || 'lead';
  field('routeId').innerHTML = '<option value="">新建一条线路</option>' + [...state.routes].reverse().map(r => `<option value="${esc(r.id)}">${esc(r.place)} · ${esc(r.grade)} · ${esc(routeTitle(r))}</option>`).join('');
  const selected = routeId || log?.routeId || '';
  field('routeId').value = selected; field('routeId').disabled = Boolean(log);
  fillRoute(state.routes.find(r => r.id === selected));
  if (!selected && lastRoute) { field('place').value = lastRoute.place; field('scene').value = lastRoute.scene; updateConditional(); }
  if (log) { for (const name of ['method', 'result', 'feel', 'belayer', 'notes']) field(name).value = log[name]; updateConditional(); field('style').value = log.style; }
  else if (last && last.date === today()) field('belayer').value = last.belayer;
  for (const [list, values] of [['places', state.routes.map(r => r.place)], ['setters', state.routes.map(r => r.setter)], ['belayers', state.logs.map(l => l.belayer)]]) $('#' + list).innerHTML = [...new Set(values.filter(Boolean))].map(v => `<option value="${esc(v)}"></option>`).join('');
  $('#log-extras').open = Boolean(log?.notes || log?.belayer);
  $('#editor').showModal(); $('#editor').scrollTop = 0;
}
async function compressPhoto(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('单张照片不能超过 30 MB');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } catch (error) { if (error.message.includes('30 MB')) throw error; throw new Error('无法读取照片，请选择浏览器支持的 JPEG、PNG 或 WebP 图片'); }
  finally { URL.revokeObjectURL(url); }
}
async function saveLog(event) {
  event.preventDefault(); if (saving || photoBusy) return;
  saving = true; $('#save-log').disabled = true; $('#save-log').textContent = '正在保存…'; $('#form-error').textContent = '';
  try {
    // Re-read before mutation so a second tab's writes are not lost.
    state = await readAll();
    const existingLog = editingId && state.logs.find(l => l.id === editingId);
    if (editingId && !existingLog) throw new Error('这条记录已被删除，请关闭表单后重试');
    const existingRoute = field('routeId').value && state.routes.find(r => r.id === field('routeId').value);
    if (field('routeId').value && !existingRoute) throw new Error('所选线路已不存在，请重新选择');
    let route = validateRoute({ id: existingRoute?.id || crypto.randomUUID(), scene: field('scene').value, place: field('place').value.trim(), area: field('scene').value === 'outdoor' ? field('area').value.trim() : '', grade: field('grade').value, feature: field('feature').value.trim(), color: field('color').value, length: field('length').value === '' ? null : Number(field('length').value), setter: field('scene').value === 'gym' ? field('setter').value.trim() : '', photos, target: field('target').value, projectStatus: field('isProject').checked ? field('projectStatus').value : '' });
    const log = validateLog({ id: existingLog?.id || crypto.randomUUID(), routeId: route.id, date: field('date').value, createdAt: existingLog?.createdAt || Date.now(), method: field('method').value, result: field('result').value, style: field('result').value === 'send' ? field('style').value : '', feel: field('feel').value, belayer: field('method').value === 'auto' ? '' : field('belayer').value.trim(), notes: field('notes').value.trim() });
    route = completeProject(route, log);
    await write({ routes: [route], logs: [log] });
    $('#editor').close(); await refresh(); toast(existingLog ? '记录已更新' : '已记下这次攀爬');
  } catch (error) { $('#form-error').textContent = error.name === 'QuotaExceededError' ? '存储空间不足，未保存。请先导出备份并释放空间。' : error.message; }
  finally { saving = false; $('#save-log').disabled = false; $('#save-log').textContent = '保存记录'; }
}
function routeHistory(r) {
  const logs = sortedLogs().filter(l => l.routeId === r.id), total = counts(logs);
  return `<section class="history"><h3>线路历史</h3><p class="hint">已记录 ${total.total} 次上墙，${total.sends} 次成功</p>${Object.entries(METHODS).map(([key, label]) => { const c = counts(logs, null, key); return c.total ? `<p class="hint">${label}：${c.total} 次上墙 / ${c.sends} 次成功</p>` : ''; }).join('')}${logs.map(l => `<div class="history-line"><span>${esc(l.date)} · ${METHODS[l.method]}</span><span>${l.result === 'send' ? STYLES[l.method][l.style] : 'Attempt'}</span></div>`).join('')}</section>`;
}
function openDetail({ logId, routeId }) {
  const l = logId && state.logs.find(l => l.id === logId), r = l ? routeOf(l) : state.routes.find(r => r.id === routeId); if (!r) return;
  const entries = [['地点', placeText(r)], ['场景', SCENES[r.scene]], ['难度', r.grade], ['颜色', r.color ? COLORS[r.color][0] : '未记录'], ['长度', r.length ? r.length + ' 米' : '未记录'], ['定线员', r.setter || '未记录']];
  if (l) entries.push(['日期', l.date], ['方式', METHODS[l.method]], ['结果', l.result === 'send' ? 'Send 成功' : 'Attempt 尝试'], ['完攀类型', l.result === 'send' ? STYLES[l.method][l.style] : '—'], ['体感', l.feel || '未记录'], ['保护员', l.belayer || '未记录']);
  if (r.projectStatus) entries.push(['Project', `${PROJECTS[r.projectStatus]} · 目标${METHODS[r.target]}`]);
  $('#detail').innerHTML = `<header class="dialog-head"><div><span class="eyebrow">${l ? 'CLIMB DETAILS' : 'ROUTE HISTORY'}</span><h2 id="detail-title">${dot(r)}${esc(routeTitle(r))}</h2></div><button class="icon-button" data-action="close-detail" aria-label="关闭">×</button></header><div class="detail-body"><dl class="detail-grid">${entries.map(([key, value]) => `<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${l?.notes ? `<p class="detail-note">${esc(l.notes)}</p>` : ''}${r.photos.length ? `<div class="detail-photos">${r.photos.map((src, i) => `<img src="${src}" alt="线路照片 ${i + 1}">`).join('')}</div>` : ''}<div class="detail-actions"><button class="primary" data-action="climb-route" data-id="${esc(r.id)}">再爬一次</button>${l ? `<button class="secondary" data-action="edit" data-id="${esc(l.id)}">编辑</button><button class="danger" data-action="delete" data-id="${esc(l.id)}">删除</button>` : ''}</div>${routeHistory(r)}</div>`;
  $('#detail').showModal(); $('#detail').scrollTop = 0;
}
function ask(title, message, label = '确认') {
  return new Promise(resolve => {
    const dialog = $('#confirm-dialog'); $('#confirm-title').textContent = title; $('#confirm-text').textContent = message; $('#confirm-ok').textContent = label;
    const finish = value => { dialog.close(); $('#confirm-ok').onclick = null; $('#confirm-cancel').onclick = null; dialog.oncancel = null; resolve(value); };
    $('#confirm-ok').onclick = () => finish(true); $('#confirm-cancel').onclick = () => finish(false); dialog.oncancel = event => { event.preventDefault(); finish(false); }; dialog.showModal();
  });
}
async function exportBackup() {
  const current = await readAll(); const data = JSON.stringify(makeBackup(current.routes, current.logs));
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `climbing-log-${today()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  await write({ meta: { backupAt: new Date().toISOString() } }); await refresh(); toast('已生成完整备份，请确认文件已保存');
}
async function importBackup(file) {
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) throw new Error('备份文件超过 200 MB，无法导入');
  let input; try { input = JSON.parse(await file.text()); } catch { throw new Error('备份文件不是有效的 JSON'); }
  const incoming = validateBackup(input), current = await readAll();
  const newRoutes = incoming.routes.filter(r => !current.routes.some(c => c.id === r.id)).length;
  const newLogs = incoming.logs.filter(l => !current.logs.some(c => c.id === l.id)).length;
  if (!await ask('导入备份', `备份包含 ${incoming.logs.length} 条日志、${incoming.routes.length} 条线路和 ${incoming.routes.reduce((n, r) => n + r.photos.length, 0)} 张照片。\n将新增 ${newLogs} 条日志、${newRoutes} 条线路。同一标识的本机数据优先保留。`, '合并导入')) return;
  const latest = await readAll(), merged = mergeBackup(latest, incoming);
  await write(merged); await refresh(); toast('备份已合并导入');
}
async function handleAction(event) {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'add') openEditor();
  if (action === 'close-editor' && !saving && !photoBusy) $('#editor').close();
  if (action === 'close-detail') $('#detail').close();
  if (action === 'reset-filters') { filters = { query: '', scene: '', result: '' }; renderLogs(); }
  if (action === 'detail') openDetail({ logId: id });
  if (action === 'route-detail') openDetail({ routeId: id });
  if (action === 'climb-route') { $('#detail').close(); openEditor({ routeId: id }); }
  if (action === 'edit') { $('#detail').close(); openEditor({ logId: id }); }
  if (action === 'remove-photo' && !photoBusy) { photos.splice(Number(button.dataset.index), 1); renderPhotos(); }
  if (action === 'delete') {
    if (!await ask('删除这条日志？', '删除后无法撤销。线路资料、照片和其他日志会保留，Project 状态可手动调整。', '删除日志')) return;
    await write({ removeLogs: [id] }); $('#detail').close(); await refresh(); toast('日志已删除');
  }
  if (action === 'export') await exportBackup();
  if (action === 'import') $('#backup-file').click();
  if (action === 'persist') {
    if (!navigator.storage?.persist) return toast('当前浏览器不支持申请持久存储，请定期备份');
    const persisted = await navigator.storage.persist(); toast(persisted ? '已获准持久存储，仍请定期备份' : '浏览器未批准，请定期导出备份');
  }
}
document.addEventListener('click', event => { handleAction(event).catch(report); });
document.addEventListener('input', event => { if (event.target.id === 'search') { filters.query = event.target.value; renderLogResults(); } });
document.addEventListener('change', async event => {
  try {
    const el = event.target;
    if (el.id === 'scene-filter' || el.id === 'result-filter') { filters[el.id === 'scene-filter' ? 'scene' : 'result'] = el.value; renderLogResults(); }
    if (el.dataset.project) { const current = await readAll(); const r = current.routes.find(r => r.id === el.dataset.project); if (r) { await write({ routes: [{ ...r, projectStatus: el.value }] }); await refresh(); toast('Project 状态已更新'); } }
    if (el.name === 'routeId') fillRoute(state.routes.find(r => r.id === el.value));
    if (['scene', 'method', 'result', 'isProject'].includes(el.name)) updateConditional();
    if (el.name === 'photos') {
      const files = [...el.files]; el.value = '';
      if (files.length + photos.length > 4) throw new Error('每条线路最多保存 4 张照片');
      photoBusy = true; $('#save-log').disabled = true; $('#form-error').textContent = '正在处理照片…';
      try { const converted = []; for (const file of files) converted.push(await compressPhoto(file)); photos.push(...converted); renderPhotos(); $('#form-error').textContent = ''; }
      finally { photoBusy = false; $('#save-log').disabled = false; }
    }
    if (el.id === 'backup-file') { const file = el.files[0]; el.value = ''; await importBackup(file); }
  } catch (error) { if ($('#editor').open) $('#form-error').textContent = error.message; else report(error); }
});
$('#colors').innerHTML = Object.entries(COLORS).map(([value, [label, hex]]) => `<button type="button" class="color-button" data-color="${value}" aria-pressed="false" aria-label="${label}色"><i style="background:${hex}"></i>${label}</button>`).join('');
$('#colors').addEventListener('click', e => { const b = e.target.closest('[data-color]'); if (b) { field('color').value = field('color').value === b.dataset.color ? '' : b.dataset.color; updateColors(); } });
field('grade').innerHTML = GRADES.map(g => `<option>${g}</option>`).join('');
form.addEventListener('submit', saveLog);
$('#editor').addEventListener('cancel', e => { if (saving || photoBusy) e.preventDefault(); });
window.addEventListener('hashchange', render);
window.addEventListener('focus', () => { if (!$$('dialog[open]').length) refresh().catch(report); });
$('#main').innerHTML = '<p class="loading">正在打开本机日志…</p>';
try { await refresh(); } catch (error) { $('#main').innerHTML = '<section class="hero"><div><h1>暂时无法打开本机存储</h1><p class="subtitle">请确认浏览器允许网站保存数据，关闭无痕模式后刷新重试。未能读取数据时不会创建替代存储。</p><button class="primary" onclick="location.reload()">重新打开</button></div></section>'; console.error(error); }

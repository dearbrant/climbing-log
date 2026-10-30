import { METHODS, COLORS, GRADES, today, validateRoute, validateLog, validateBackup, makeBackup, mergeBackup } from './model.js?v=20261030-data-sync';
import { readAll, write } from './storage.js?v=20261030-detail-edit';
import { icon } from './icons.js?v=20261030-feeling-dialog';

const app = document.querySelector('#app');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const gyms = ['Camp4 SLT', 'Mellow', 'SuperBox HLG', 'SuperBox CSS', 'DingShi', 'YanShi DTN', 'YanShi XSQ', 'BeiDing Aosen', 'Super AoPan', 'WoPan', '17 ALKAKO', 'RiTan', 'Bloc1'];
const results = { onsight: 'Onsight', flash: 'Flash', redpoint: 'Redpoint', repeat: 'Repeat', attempt: 'Attempt' };
const feelLabel = { 简单: 'Easy', 中等: 'Moderate', 偏难: 'Hard', 很硬: 'Very Hard' };
let state = { routes: [], logs: [] };
let openDate = null;
let returnTo = '#home';
let initialFormData = null;
let toastTimer;
const routeFor = log => state.routes.find(route => route.id === log.routeId);
const updatedAt = log => log.updatedAt ?? log.createdAt;
const dateLabel = date => { const day = new Date(`${date}T12:00:00`); return `${day.getMonth() + 1}/${day.getDate()}/${day.getFullYear()}`; };
const weekday = date => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${date}T12:00:00`).getDay()];
const latest = logs => [...logs].sort((a, b) => updatedAt(b) - updatedAt(a) || b.createdAt - a.createdAt || b.id.localeCompare(a.id));
const colorTag = route => route.color && COLORS[route.color] ? `<span class="tag" style="color:${COLORS[route.color][1]}">${COLORS[route.color][0]}</span>` : '';
const resultTag = log => `<span class="tag result-${log.result === 'attempt' ? 'attempt' : log.style}">${log.result === 'attempt' ? 'Attempt' : results[log.style] || 'Send'}</span>`;
const tags = (log, route, projectAction = false) => `${resultTag(log)}${route.projectStatus ? projectAction ? '<button class="tag project project-link" data-action="projects">Project</button>' : '<span class="tag project">Project</span>' : ''}${log.feel ? `<span class="tag">${escapeHtml(feelLabel[log.feel] || log.feel)}</span>` : ''}<span class="tag">${METHODS[log.method]}</span>${colorTag(route)}<span class="tag">${escapeHtml(route.place)}</span><span class="tag">${dateLabel(log.date)} ${weekday(log.date)}</span>`;
const header = (title, action = 'navigate') => `<header class="screen-head single"><h1>${title}</h1><button class="icon-button" data-action="${action}" data-to="#home" aria-label="Close">${icon('close')}</button></header>`;
function showToast(message) { const element = document.querySelector('#toast'); element.textContent = message; element.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 2500); }
function card(log, projectAction = true) { const route = routeFor(log); if (!route) return ''; return `<article class="climb-card"><button class="card-open" data-action="navigate" data-to="#detail/${escapeHtml(log.id)}" aria-label="查看 ${escapeHtml(route.grade)} 攀爬详情"><strong class="card-grade">${escapeHtml(route.grade)}</strong></button><div class="tags">${tags(log, route, projectAction)}</div></article>`; }
function renderHome() {
  const grouped = new Map();
  for (const log of state.logs) if (routeFor(log)) { if (!grouped.has(log.date)) grouped.set(log.date, []); grouped.get(log.date).push(log); }
  const dates = [...grouped.keys()].sort((a, b) => b.localeCompare(a));
  if (openDate === null || (openDate && !grouped.has(openDate))) openDate = dates[0] || null;
  app.innerHTML = `<div class="app home${dates.length ? '' : ' home-empty'}"><header class="screen-head"><h1>CLIMBING<br>LOG</h1><button class="home-settings" data-action="navigate" data-to="#sync" aria-label="Data Sync">${icon('setting')}</button></header>${dates.length ? dates.map((date, index) => `<section class="date-group"><h2><button class="date-toggle" data-action="toggle-date" data-date="${date}" aria-expanded="${date === openDate}" aria-controls="day-${index}"><span>${dateLabel(date)}</span><span class="weekday">${weekday(date)}</span><span class="count">${grouped.get(date).length}</span></button></h2><div class="cards" id="day-${index}" ${date === openDate ? '' : 'hidden'}>${latest(grouped.get(date)).map(log => card(log)).join('')}</div></section>`).join('') : '<img class="home-empty-art" src="./icons/ic_empty.svg" alt="">'}<button class="fab" data-action="navigate" data-to="#new" aria-label="新增攀爬记录">${icon('add')}</button></div>`;
}
const option = (value, label, selected) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
const selectField = (name, label, iconName, choices, selected) => `<label class="field"><b class="field-icon" aria-hidden="true">${icon(iconName)}</b><select name="${name}" aria-label="${label}">${choices.map(([value, text]) => option(value, text, selected)).join('')}</select></label>`;
const dateField = value => `<label class="field"><b class="field-icon" aria-hidden="true">${icon('date')}</b><input name="date" type="date" value="${escapeHtml(value)}" aria-label="攀爬日期"></label>`;
function renderForm(id) {
  const log = id && state.logs.find(item => item.id === id); if (id && !log) return navigate('#home');
  const route = log && routeFor(log);
  const currentGrade = route?.grade || '5.10d';
  const gradeOptions = GRADES.includes(currentGrade) ? GRADES : [currentGrade, ...GRADES];
  const currentFeel = feelLabel[log?.feel] || log?.feel || 'Moderate';
  const currentResult = log?.result === 'attempt' ? 'attempt' : log?.style || 'redpoint';
  const currentColor = route?.color || 'black';
  const places = route?.place && !gyms.includes(route.place) ? [route.place, ...gyms] : gyms;
  const dialogs = id ? `<dialog class="confirm-dialog" id="delete-confirm" aria-labelledby="delete-confirm-title"><h2 id="delete-confirm-title">Delete this climb?</h2><p>This cannot be undone.</p><div class="confirm-actions"><button type="button" data-action="cancel-delete">Cancel</button><button type="button" data-action="confirm-delete" data-id="${escapeHtml(id)}">Delete Climb</button></div></dialog><dialog class="confirm-dialog" id="discard-confirm" aria-labelledby="discard-confirm-title"><h2 id="discard-confirm-title">Discard changes?</h2><p>Your edits won't be saved.</p><div class="confirm-actions"><button type="button" data-action="discard-changes">Discard</button><button type="button" data-action="keep-editing" autofocus>Keep Editing</button></div></dialog>` : '';
  app.innerHTML = `<div class="app">${header(id ? 'CLIMB<br>DETAIL' : 'LOG<br>A CLIMB', id ? 'close-detail' : 'navigate')}<form id="climb-form" class="form" data-id="${escapeHtml(id || '')}">
    ${dateField(log?.date || today())}
    ${selectField('place', 'Climbing Gym', 'place', places.map(value => [value, value]), route?.place || 'Mellow')}
    ${selectField('method', 'Climbing Style', 'method', Object.entries(METHODS), log?.method || 'auto')}
    ${selectField('color', 'Line Color', 'color', Object.entries(COLORS).map(([value, [text]]) => [value, text]), currentColor)}
    ${selectField('grade', 'Grade', 'grade', gradeOptions.map(value => [value, value]), currentGrade)}
    ${selectField('feel', 'Perceived Difficulty', 'feel', ['Easy', 'Moderate', 'Hard', 'Very Hard'].map(value => [value, `Feel ${value}`]), currentFeel)}
    ${selectField('outcome', 'Send Type', 'outcome', Object.entries(results), currentResult)}
    ${selectField('project', 'Project', 'project', [['no', 'Not a Project'], ['yes', 'Project']], route?.projectStatus ? 'yes' : 'no')}
    <p class="error" id="form-error" role="alert"></p><button class="save-button" type="submit">${id ? 'Update Climb' : 'Log This Climb'}</button>
    ${id ? '<button class="save-button delete-button" type="button" data-action="delete">Delete</button>' : ''}
  </form>${dialogs}</div>`;
  updateColor();
  initialFormData = id ? JSON.stringify([...new FormData(app.querySelector('#climb-form'))]) : null;
}
function updateColor() { const select = app.querySelector('[name="color"]'); if (select) select.style.color = COLORS[select.value]?.[1] || '#111'; }
function renderProjects() {
  const seen = new Set();
  const logs = latest(state.logs.filter(log => routeFor(log)?.projectStatus)).filter(log => { if (seen.has(log.routeId)) return false; seen.add(log.routeId); return true; });
  app.innerHTML = `<div class="app home">${header('PROJECT')}${logs.length ? `<div class="project-list">${logs.map(log => card(log, false)).join('')}</div>` : '<p class="empty">No routes marked as Projects yet.</p>'}<button class="fab" data-action="navigate" data-to="#new" aria-label="新增攀爬记录">${icon('add')}</button></div>`;
}
function renderSync() {
  app.innerHTML = `<div class="app sync-page">${header('DATA<br>SYNC')}<img class="sync-art" src="./icons/ic_datasync.svg" alt=""><div class="sync-actions"><button type="button" data-action="export-data">Export Data</button><button type="button" data-action="import-backup">Import Backup</button><input class="sync-file-input" id="backup-file" type="file" accept=".json,application/json" tabindex="-1"></div></div>`;
}
const formValues = form => JSON.stringify([...new FormData(form)]);
function closeDetail() { if (formValues(app.querySelector('#climb-form')) !== initialFormData) app.querySelector('#discard-confirm').showModal(); else navigate(returnTo); }
function navigate(hash) { if (hash.startsWith('#detail/')) returnTo = location.hash === '#projects' ? '#projects' : '#home'; location.hash = hash; render(); }
function render() { const [page, id] = location.hash.slice(1).split('/'); if (page === 'new') renderForm(); else if (page === 'detail' || page === 'edit') renderForm(id); else if (page === 'projects') renderProjects(); else if (page === 'sync') renderSync(); else renderHome(); }
function downloadBackup(file) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  showToast('Backup ready to save.');
}
function exportData() {
  const name = `climbing-log-${today()}.json`;
  const file = new File([JSON.stringify(makeBackup(state.routes, state.logs), null, 2)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch(error => { if (error.name !== 'AbortError') downloadBackup(file); });
  } else downloadBackup(file);
}
async function importBackup(input) {
  const file = input.files[0]; input.value = '';
  if (!file) return;
  try {
    const backup = validateBackup(JSON.parse(await file.text()));
    const current = await readAll(), merged = mergeBackup(current, backup);
    await write(merged); state = await readAll(); openDate = null;
    const added = merged.logs.length - current.logs.length;
    showToast(added ? `${added} climb${added === 1 ? '' : 's'} imported.` : 'No new climbs to import.');
  } catch (error) { showToast(error instanceof SyntaxError ? 'This is not a valid backup file.' : error.message || 'Unable to import backup.'); }
}
async function saveForm(form) {
  const id = form.dataset.id || null, existingLog = id ? state.logs.find(log => log.id === id) : null, oldRoute = existingLog ? routeFor(existingLog) : null;
  if (id && !existingLog) throw new Error('This climb is no longer available. Return to Home.');
  const data = new FormData(form), now = Date.now(), outcome = data.get('outcome');
  const shared = oldRoute && state.logs.some(log => log.routeId === oldRoute.id && log.id !== id);
  const routeId = oldRoute && !shared ? oldRoute.id : newId();
  const route = validateRoute({ id: routeId, scene: oldRoute?.scene || 'gym', place: data.get('place'), area: oldRoute?.area || '', grade: data.get('grade'), feature: oldRoute?.feature || '', color: data.get('color'), length: oldRoute?.length ?? null, setter: oldRoute?.setter || '', photos: oldRoute?.photos || [], target: data.get('method'), projectStatus: data.get('project') === 'yes' ? oldRoute?.projectStatus || 'active' : '' });
  const log = validateLog({ id: existingLog?.id || newId(), routeId, date: data.get('date'), createdAt: existingLog?.createdAt || now, updatedAt: now, method: data.get('method'), result: outcome === 'attempt' ? 'attempt' : 'send', style: outcome === 'attempt' ? '' : outcome, feel: data.get('feel'), belayer: existingLog?.belayer || '', notes: existingLog?.notes || '' });
  await write({ routes: [route], logs: [log] }); state = await readAll(); openDate = log.date; navigate('#home'); showToast(id ? 'Climb updated.' : 'Climb logged.');
}
async function deleteClimb(id) {
  const log = state.logs.find(item => item.id === id);
  if (!log) return;
  const removeRoutes = state.logs.some(item => item.id !== id && item.routeId === log.routeId) ? [] : [log.routeId];
  await write({ removeLogs: [id], removeRoutes });
  state = await readAll(); openDate = null; navigate('#home'); showToast('Climb deleted.');
}
app.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control) { const card = event.target.closest('.climb-card'); if (card) card.querySelector('.card-open')?.click(); return; }
  if (control.dataset.action === 'navigate') navigate(control.dataset.to);
  if (control.dataset.action === 'export-data') exportData();
  if (control.dataset.action === 'import-backup') app.querySelector('#backup-file').click();
  if (control.dataset.action === 'close-detail') closeDetail();
  if (control.dataset.action === 'projects') navigate('#projects');
  if (control.dataset.action === 'toggle-date') { openDate = control.dataset.date; renderHome(); }
  if (control.dataset.action === 'delete') app.querySelector('#delete-confirm').showModal();
  if (control.dataset.action === 'cancel-delete') app.querySelector('#delete-confirm').close();
  if (control.dataset.action === 'confirm-delete') { app.querySelector('#delete-confirm').close(); deleteClimb(control.dataset.id).catch(error => showToast(error.message || 'Unable to delete this climb.')); }
  if (control.dataset.action === 'keep-editing') app.querySelector('#discard-confirm').close();
  if (control.dataset.action === 'discard-changes') { app.querySelector('#discard-confirm').close(); navigate(returnTo); }
});
app.addEventListener('change', event => { if (event.target.name === 'color') updateColor(); if (event.target.id === 'backup-file') importBackup(event.target); });
app.addEventListener('submit', async event => { if (event.target.id !== 'climb-form') return; event.preventDefault(); const button = event.target.querySelector('[type="submit"]'); button.disabled = true; try { await saveForm(event.target); } catch (error) { event.target.querySelector('#form-error').textContent = error.message || 'Unable to save this climb.'; button.disabled = false; } });
window.addEventListener('hashchange', render);
app.innerHTML = '<div class="app"><p class="empty">Opening your climbing log…</p></div>';
try { state = await readAll(); render(); } catch (error) { app.innerHTML = `<div class="app"><p class="empty">Unable to open your climbing log: ${escapeHtml(error.message)}</p></div>`; }

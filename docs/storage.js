const DB_NAME = 'climbing-log-v1';
let dbPromise;
export function openDB() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('routes', { keyPath: 'id' }); db.createObjectStore('logs', { keyPath: 'id' }); db.createObjectStore('meta', { keyPath: 'id' }); };
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); dbPromise = null; }; resolve(db); };
    request.onerror = () => { dbPromise = null; reject(new Error('Unable to open your climbing log.')); };
    request.onblocked = () => { dbPromise = null; reject(new Error('Close other Climbing Log tabs and try again.')); };
  });
  return dbPromise;
}
export async function readAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['routes', 'logs', 'meta'], 'readonly');
    const routes = tx.objectStore('routes').getAll(), logs = tx.objectStore('logs').getAll(), meta = tx.objectStore('meta').getAll();
    tx.oncomplete = () => resolve({ routes: routes.result, logs: logs.result, meta: Object.fromEntries(meta.result.map(m => [m.id, m.value])) });
    tx.onerror = tx.onabort = () => reject(new Error('Unable to load your climbing log.'));
  });
}
export async function write({ routes = [], logs = [], removeLogs = [], removeRoutes = [], meta = {} }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['routes', 'logs', 'meta'], 'readwrite');
    for (const r of routes) tx.objectStore('routes').put(r);
    for (const l of logs) tx.objectStore('logs').put(l);
    for (const id of removeLogs) tx.objectStore('logs').delete(id);
    for (const id of removeRoutes) tx.objectStore('routes').delete(id);
    for (const [id, value] of Object.entries(meta)) tx.objectStore('meta').put({ id, value });
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error('Unable to save your climbing log.'));
  });
}

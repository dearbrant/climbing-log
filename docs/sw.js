const CACHE_PREFIX = 'climbing-log-offline-';
const CACHE_NAME = `${CACHE_PREFIX}20261109-v5`;
const ASSETS = [
  './index.html',
  './style.css?v=20261109-palette-scroll',
  './app.js?v=20261109-palette-scroll',
  './model.js?v=20261109-palette-scroll',
  './storage.js?v=20261030-detail-edit',
  './icons.js?v=20261030-feeling-dialog',
  './fonts/logo-sc-latin.woff2',
  './fonts/google-sans-flex-latin.woff2',
  './apple-touch-icon.png?v=20261108-icon',
  './icons/ic_add.svg',
  './icons/ic_cancel.svg',
  './icons/ic_setting.svg',
  './icons/ic_date.svg',
  './icons/ic_location.svg',
  './icons/ic_style.svg',
  './icons/ic_color.svg',
  './icons/ic_grade.svg',
  './icons/ic_feeling.svg?v=20261030-feeling-dialog',
  './icons/ic_sent.svg',
  './icons/ic_project.svg',
  './icons/ic_empty.svg',
  './icons/ic_datasync.svg',
];
const assetURLs = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
const indexURL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' }))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate' &&
      (url.pathname === scope.pathname || url.pathname === new URL(indexURL).pathname)) {
    // Prefer the published page online; use the installed page when offline.
    event.respondWith(fetch(request).then(response => {
      if (!response.ok) throw new Error('Page unavailable');
      return response;
    }).catch(() => caches.open(CACHE_NAME).then(cache => cache.match(indexURL))));
  } else if (assetURLs.has(url.href)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache =>
      await cache.match(request) || fetch(request)
    ));
  }
});

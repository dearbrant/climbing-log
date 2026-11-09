import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../docs/sw.js', import.meta.url), 'utf8');
const scope = 'https://example.com/climbing-log/';
function worker({ networkFails = false } = {}) {
  const handlers = new Map(), stores = new Map(), deleted = [], network = [];
  let claimed = false;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          if (networkFails) throw new Error('offline');
          for (const request of requests) store.set(request.url, new Response(request.url));
        },
        async match(request) { return store.get(typeof request === 'string' ? request : request.url)?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  const context = vm.createContext({
    URL, Request, Response, caches,
    fetch: async request => {
      network.push(request.url);
      if (networkFails) throw new Error('offline');
      return new Response('published page');
    },
    self: { registration: { scope }, clients: { async claim() { claimed = true; } },
      addEventListener(type, handler) { handlers.set(type, handler); } },
  });
  vm.runInContext(source, context);
  return {
    stores, deleted, network,
    get claimed() { return claimed; },
    async lifecycle(type) {
      let pending;
      handlers.get(type)({ waitUntil(promise) { pending = promise; } });
      await pending;
    },
    fetch(path, options = {}) {
      let result;
      handlers.get('fetch')({ request: { url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options },
        respondWith(promise) { result = promise; } });
      return result;
    },
  };
}

test('离线缓存清单覆盖当前页面、模块依赖、字体及图标，且文件存在', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  const assets = [...[...sw.stores.values()][0].keys()];
  const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../docs/app.js', import.meta.url), 'utf8');
  const icons = await readFile(new URL('../docs/icons.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../docs/style.css', import.meta.url), 'utf8');
  const references = [
    './index.html', './icons/ic_empty.svg', './icons/ic_datasync.svg',
    ...[...html.matchAll(/(?:href|src)="(\.\/[^\"]+\.(?:png|css|js)(?:\?[^\"]*)?)"/g)].map(m => m[1]),
    ...[...app.matchAll(/from '(\.\/[^']+)'/g)].map(m => m[1]),
    ...[...icons.matchAll(/: '([^']+\.svg[^']*)'/g)].map(m => `./icons/${m[1]}`),
    ...[...css.matchAll(/url\("([^\"]+)"\)/g)].map(m => m[1]),
  ];
  for (const path of references) assert.ok(assets.includes(new URL(path, scope).href), `未预缓存 ${path}`);
  for (const asset of assets) {
    const path = new URL(asset).pathname.slice(new URL(scope).pathname.length);
    assert.ok((await readFile(new URL(`../docs/${path}`, import.meta.url))).length > 0, path);
  }
});

test('联网打开页面优先读取网络，不用旧页面挡住已发布更新', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  const response = await sw.fetch('./?release=new', { mode: 'navigate' });
  assert.equal(await response.text(), 'published page');
});

test('断网重开含查询参数的入口及原生模块资源仍可用', async () => {
  const online = worker();
  await online.lifecycle('install');
  const offline = worker({ networkFails: true });
  for (const [key, value] of online.stores) offline.stores.set(key, value);
  const page = await offline.fetch('./?release=new', { mode: 'navigate' });
  assert.equal(await page.text(), `${scope}index.html`);
  const module = await offline.fetch('./app.js?v=20261109-sync-feedback');
  assert.equal(await module.text(), `${scope}app.js?v=20261109-sync-feedback`);
  assert.equal(offline.network.length, 1);
});

test('只处理应用范围内资源，不拦截其他站点、路径和写入请求', () => {
  const sw = worker();
  assert.equal(sw.fetch('https://other.example/app.js'), undefined);
  assert.equal(sw.fetch('../other/index.html', { mode: 'navigate' }), undefined);
  assert.equal(sw.fetch('./index.html', { method: 'POST' }), undefined);
  assert.equal(sw.fetch('./unrelated.json'), undefined);
});

test('缓存安装失败不会执行激活清理；激活只清理本应用旧缓存', async () => {
  const failed = worker({ networkFails: true });
  await assert.rejects(failed.lifecycle('install'), /offline/);
  assert.deepEqual(failed.deleted, []);
  const sw = worker();
  sw.stores.set('other-site-assets', new Map());
  sw.stores.set('climbing-log-offline-old', new Map());
  await sw.lifecycle('install');
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['climbing-log-offline-old']);
  assert.equal(sw.claimed, true);
});

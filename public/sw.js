/* Life Wishlist — 离线 Service Worker
 *
 * 策略：
 *  - install：预缓存应用外壳 + 从 index.html 中解析出的构建产物（JS/CSS/图标）。
 *    这样首次在线打开后，即使还没发生第二次访问，也能立刻离线使用。
 *  - 导航请求：network-first，失败时回落到缓存的 index.html。
 *    保证部署新版本时能拿到新的 HTML（其中引用了新的带哈希资源名）。
 *  - 其它同源 GET：cache-first + 运行时补缓存；带哈希的资源内容变化时 URL 也会变。
 *
 * 注意：所有请求都限定同源；本应用不向任何第三方发起请求。
 */
const CACHE_NAME = 'life-wishlist-shell-v1';
const SCOPE = self.registration.scope; // 以 / 结尾，例如 https://xxx.github.io/life-wishlist/
const abs = (p) => new URL(p, SCOPE).href;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(SHELL.map((u) => cache.add(abs(u)).catch(() => undefined)));

      // 解析 index.html，把 Vite 生成的带哈希 JS/CSS 一起预缓存
      try {
        const res = await fetch(abs('./index.html'), { cache: 'no-store' });
        const html = await res.text();
        const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((m) => m[1])
          .filter((u) => /\.(js|css|svg|png|webp|jpg|jpeg|woff2?)$/i.test(u.split('?')[0]));
        await Promise.all(refs.map((r) => cache.add(new URL(r, SCOPE).href).catch(() => undefined)));
      } catch (_) {
        /* 离线安装时忽略，activate 后的运行时缓存仍会兜底 */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME && k.startsWith('life-wishlist')).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不碰第三方

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put(abs('./index.html'), net.clone()).catch(() => undefined);
          return net;
        } catch (_) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(abs('./index.html'))) || (await cache.match(abs('./'))) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const net = await fetch(req);
        if (net && net.ok && net.type === 'basic') await cache.put(req, net.clone()).catch(() => undefined);
        return net;
      } catch (_) {
        return (await cache.match(abs('./index.html'))) || Response.error();
      }
    })()
  );
});

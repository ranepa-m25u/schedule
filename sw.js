const CACHE_NAME = 'ranepa-m25u-v23';

const PRECACHE = [
  './',
  './index.html',
  './schedule.json',
  './manifest.webmanifest',
  './ranepa_crest.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Каждый файл кладём отдельно, чтобы один сбой не ломал установку
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Сначала сеть (чтобы правки расписания и страницы подтягивались сразу), при отсутствии интернета — кэш
function networkFirst(request, fallbackUrl) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return res;
    })
    .catch(() =>
      caches.match(request).then((cached) => cached || (fallbackUrl ? caches.match(fallbackUrl) : undefined))
    );
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request, './index.html'));
    return;
  }

  // Расписание всегда пробуем взять свежим
  if (url.pathname.endsWith('/schedule.json')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Остальное (картинки, manifest): из кэша, а если нет — из сети с досохранением
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return (
        cached ||
        fetch(e.request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return res;
        })
      );
    })
  );
});

/* Atlas Concursos — service worker: funciona offline depois do primeiro acesso. */
const CACHE = 'atlas-v1';
const SHELL = [
  './',
  'index.html',
  'privacidade.html',
  'manifest.webmanifest',
  'assets/css/styles.css',
  'assets/js/config.js',
  'assets/js/data.js',
  'assets/js/app.js',
  'assets/js/tools.js',
  'assets/js/cloud.js',
  'assets/img/logo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Arquivos do próprio site: rede primeiro (sempre atualizado), cache como reserva offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

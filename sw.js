// IronCheck — Service Worker
// Estratégia: network-first com fallback para cache.
// Assim o app sempre pega a versão mais nova quando há internet (importante,
// porque o deploy é upload manual do index.html), mas continua abrindo offline.
const CACHE = 'ironcheck-v2.9';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Firestore/Auth usam seus próprios mecanismos — não interceptar chamadas do Google APIs
  const url = e.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit') || url.includes('securetoken')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Guarda uma cópia no cache para uso offline (inclui CDNs: Chart.js, fontes, Firebase)
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // Navegação offline sem cache da URL exata → entrega o app shell
          if (e.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});

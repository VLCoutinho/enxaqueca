// sw.js — Service Worker robusto para Diário de Enxaqueca
const CACHE_NAME = 'enxaqueca-v2';

// Arquivos locais que devem ser cacheados na instalação
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Recursos externos (CDN) cacheados na instalação
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ── INSTALL: pre-cache tudo ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cacheia locais (falha silenciosa por item)
      for (const url of LOCAL_ASSETS) {
        try { await cache.add(url); } catch(e) { console.warn('SW cache miss:', url, e); }
      }
      // Cacheia externos com mode:'cors'
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'cors' });
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res);
        } catch(e) { console.warn('SW external cache miss:', url, e); }
      }
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpa caches antigos ──────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: cache-first para tudo ────────────────────────────────
self.addEventListener('fetch', event => {
  // Ignora requisições não-GET e chrome-extension
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Não está no cache: busca na rede e armazena
      return fetch(event.request.clone()).then(response => {
        if (!response || response.status !== 200) return response;
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline e não cacheado: retorna página principal como fallback
        return caches.match('./index.html');
      });
    })
  );
});

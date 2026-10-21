/* Permite abrir la app sin internet. Los datos sin conexión los maneja Firebase por su cuenta. */
const VERSION = 'amare-v2.3.0';
const APP = ['./', 'index.html', 'styles.css', 'manifest.json', 'logo-sm.png', 'icon-192.png',
  'js/firebase-config.js', 'js/util.js', 'js/db.js', 'js/negocio.js', 'js/documentos.js', 'js/demo.js', 'js/app.js', 'js/pantallas.js', 'js/codigos.js', 'js/recibos.js', 'js/balance.js', 'js/main.js'];
const EXTERNOS = ['https://cdnjs.cloudflare.com/', 'https://www.gstatic.com/firebasejs/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  const externo = EXTERNOS.some(p => req.url.startsWith(p));
  if (!propio && !externo) return; // Firestore y Auth van directo
  if (propio) {
    // Red primero: así siempre se ve la última versión publicada; sin internet, usa la copia.
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
  } else {
    // Librerías externas: copia guardada primero (no cambian).
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const c = res.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); } return res; })));
  }
});

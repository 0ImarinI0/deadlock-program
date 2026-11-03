// Offline cache for DeadlockNews
const CACHE = 'dn-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('/index.html') || req.url.includes('news.json');
  if (isPage) {
    // network first: always pick up the latest version, fall back to cache offline
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => { const copy = res.clone(); const key = req.url.includes('news.json') ? './news.json' : './index.html'; caches.open(CACHE).then(c => c.put(key, copy)); return res; }).catch(() => caches.match(req.url.includes('news.json') ? './news.json' : './index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); return res;
  })));
});

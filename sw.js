/* Independence — service worker
   The app is one HTML file, so "offline" only needs the shell plus the fonts and
   libraries it pulls in. Data already lives in local storage and OneDrive. */
const VERSION = 'independence-v1.21.1';
const SHELL = './';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll([SHELL])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // never cache Microsoft sign-in or Graph — always live
  if (/login\.microsoftonline\.com|graph\.microsoft\.com/.test(url.host)) return;

  // the page itself: network first, so a new version is picked up as soon as it is there
  if (req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(SHELL, copy));
        return res;
      }).catch(() => caches.match(SHELL).then(r => r || Response.error()))
    );
    return;
  }

  // fonts and libraries: serve from cache, refresh in the background
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|alcdn\.msauth\.net/.test(url.host)){
    e.respondWith(
      caches.match(req).then(hit => {
        const live = fetch(req).then(res => {
          if (res && res.status === 200) caches.open(VERSION).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => hit);
        return hit || live;
      })
    );
  }
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

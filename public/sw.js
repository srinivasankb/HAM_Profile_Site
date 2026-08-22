const CACHE_NAME = 'vu35kb-v2';
const STATIC_ASSETS = [
    '/',
    '/grid',
    '/weather',
    '/weather/index.html',
    '/india-band-plan',
    '/index.html',
    '/manifest.json',
    '/favicon.png',
    '/avatar.png',
];

// On install: cache all static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// On activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

function offlineNavigateFallback(url) {
    if (url.pathname.startsWith('/weather')) {
        return caches.match('/weather/index.html')
            || caches.match('/weather')
            || caches.match('/index.html');
    }
    return caches.match('/index.html');
}

// Fetch strategy: Network-first for API calls, Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Always fetch API calls from network (never cache weather data here)
    if (url.hostname.includes('openweathermap') || url.hostname.includes('openstreetmap') || url.hostname.includes('n8n.srinikb.in')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache new successful responses
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return offlineNavigateFallback(url);
                }
            });
        })
    );
});

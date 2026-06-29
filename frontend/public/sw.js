// frontend/public/sw.js
// Service Worker for Orthodox Econet Mini App
// Strategy: Network-first for API calls; cache-first for static assets
// Offline: serves cached announcements + recent posts; queues new posts

const CACHE_VERSION   = 'v1';
const STATIC_CACHE    = `orthodox-econet-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE   = `orthodox-econet-dynamic-${CACHE_VERSION}`;
const POST_QUEUE_KEY  = 'queued-posts';

// Static assets to pre-cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API paths to cache for offline access (network-first, fallback to cache)
const CACHEABLE_API_PATHS = [
  '/api/broadcast',         // General announcements (home screen)
  '/api/users/me',          // User profile
  '/api/notifications/unread-count',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate — clean old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, Telegram SDK, and socket.io requests
  if (
    request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/bot')
  ) {
    return;
  }

  // API requests — network-first, cache fallback for approved paths
  if (url.pathname.startsWith('/api/')) {
    const shouldCache = CACHEABLE_API_PATHS.some((p) => url.pathname.startsWith(p));
    if (shouldCache) {
      event.respondWith(networkFirstWithCache(request));
    }
    return;
  }

  // Static assets — cache-first
  event.respondWith(cacheFirstWithNetwork(request));
});

// ─── Network-first strategy ───────────────────────────────────────────────────
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'You are offline. Showing cached data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Cache-first strategy ─────────────────────────────────────────────────────
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return index.html as SPA fallback
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

// ─── Background sync for queued posts ────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queued-posts') {
    event.waitUntil(syncQueuedPosts());
  }
});

async function syncQueuedPosts() {
  try {
    // Open IndexedDB to read queued posts
    const db = await openDB();
    const queued = await getAllFromDB(db, 'post-queue');
    for (const item of queued) {
      try {
        const response = await fetch('/api/posts', {
          method:  'POST',
          headers: { Authorization: `Bearer ${item.token}` },
          body:    item.formData,
        });
        if (response.ok) {
          await deleteFromDB(db, 'post-queue', item.id);
        }
      } catch {
        // Will retry on next sync
      }
    }
  } catch (err) {
    console.warn('[SW] Sync failed:', err);
  }
}

// ─── Minimal IndexedDB helpers ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('orthodox-econet', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('post-queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function getAllFromDB(db, store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function deleteFromDB(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

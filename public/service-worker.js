// service-worker.js - Nigeram Staff Attendance System PWA
const CACHE_NAME = 'nigeram-attendance-v2.0';
const APP_NAME = 'Nigeram Staff Attendance';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css'
];

// API endpoints that should be cached
const API_CACHE = [
  '/api/staff',
  '/api/attendance',
  '/api/departments'
];

// Image assets to cache
const IMAGE_ASSETS = [
  '/icons/nigeram.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/social-preview.png'
];

// Fonts and external resources
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/antd/5.10.1/reset.min.css'
];

// ========== INSTALL EVENT ==========
self.addEventListener('install', (event) => {
  console.log(`[Service Worker] ${APP_NAME} installing...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        
        // Cache all critical assets
        const allAssets = [...PRECACHE_ASSETS, ...IMAGE_ASSETS];
        return cache.addAll(allAssets)
          .then(() => {
            console.log('[Service Worker] All assets cached');
            
            // Skip waiting to activate immediately
            self.skipWaiting();
          })
          .catch((error) => {
            console.error('[Service Worker] Cache addAll error:', error);
          });
      })
  );
});

// ========== ACTIVATE EVENT ==========
self.addEventListener('activate', (event) => {
  console.log(`[Service Worker] ${APP_NAME} activated`);
  
  event.waitUntil(
    // Clean up old caches
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
    .then(() => {
      console.log('[Service Worker] Ready to handle fetches');
      
      // Send ready message to all clients
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_READY',
            version: '2.0',
            cache: CACHE_NAME
          });
        });
      });
    })
  );
});

// ========== FETCH EVENT ==========
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      requestUrl.protocol === 'chrome-extension:') {
    return;
  }

  // Handle API requests with network-first strategy
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // Handle image requests with cache-first strategy
  if (requestUrl.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }

  // Handle static assets with cache-first strategy
  if (requestUrl.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }

  // Handle navigation requests with network-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // Default: try cache first, then network
  event.respondWith(cacheFirstStrategy(event.request));
});

// ========== STRATEGIES ==========

// Cache First Strategy (for static assets)
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then((response) => {
      // Return cached response if found
      if (response) {
        console.log('[Service Worker] Serving from cache:', request.url);
        return response;
      }

      // If not in cache, fetch from network
      return fetch(request)
        .then((networkResponse) => {
          // Cache the new response for future use
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
                console.log('[Service Worker] Cached new resource:', request.url);
              });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.error('[Service Worker] Fetch failed:', error);
          
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/offline.html')
              .then((offlineResponse) => offlineResponse || offlineFallback());
          }
          
          // Return fallback for other requests
          return offlineFallback(request);
        });
    });
}

// Network First Strategy (for dynamic content)
function networkFirstStrategy(request) {
  return fetch(request)
    .then((networkResponse) => {
      // Cache successful API responses
      if (networkResponse.ok && request.url.includes('/api/')) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseToCache);
            console.log('[Service Worker] Cached API response:', request.url);
          });
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[Service Worker] Network request failed:', error);
      
      // Try to serve from cache
      return caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[Service Worker] Serving API from cache:', request.url);
            return cachedResponse;
          }
          
          // Return appropriate fallback for API requests
          if (request.url.includes('/api/')) {
            return new Response(
              JSON.stringify({ 
                error: 'You are offline', 
                cached: true,
                timestamp: new Date().toISOString()
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
          
          // For navigation requests, show offline page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html')
              .then((offlineResponse) => offlineResponse || offlineFallback());
          }
          
          return offlineFallback(request);
        });
    });
}

// ========== OFFLINE FALLBACK ==========
function offlineFallback(request = null) {
  // Create a simple offline response
  const offlineHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Nigeram Attendance</title>
      <style>
        body {
          margin: 0;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #051024 0%, #0a1a35 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .container {
          max-width: 500px;
          padding: 40px;
          background: rgba(10, 26, 53, 0.8);
          border-radius: 16px;
          border: 1px solid rgba(0, 150, 255, 0.3);
          backdrop-filter: blur(10px);
        }
        h1 {
          color: #00ffaa;
          margin-bottom: 20px;
          font-size: 28px;
        }
        p {
          color: #aaccff;
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
          color: #00aaff;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, #00aaff 0%, #0066cc 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>You're Offline</h1>
        <p>The Nigeram Staff Attendance System requires an internet connection.</p>
        <p>Please check your connection and try again.</p>
        <button class="button" onclick="window.location.reload()">Try Again</button>
      </div>
    </body>
    </html>
  `;

  return new Response(offlineHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Offline': 'true'
    }
  });
}

// ========== BACKGROUND SYNC ==========
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendanceData());
  }
  
  if (event.tag === 'sync-images') {
    event.waitUntil(syncFaceImages());
  }
});

// Background sync for attendance data
async function syncAttendanceData() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const attendanceRequests = requests.filter(req => 
      req.url.includes('/api/attendance') && req.method === 'POST'
    );
    
    for (const request of attendanceRequests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.delete(request);
          console.log('[Service Worker] Synced attendance data:', request.url);
        }
      } catch (error) {
        console.error('[Service Worker] Sync failed for:', request.url, error);
      }
    }
    
    // Notify clients of sync completion
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          dataType: 'attendance',
          count: attendanceRequests.length
        });
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Background sync error:', error);
  }
}

// Background sync for face images
async function syncFaceImages() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    const imageRequests = requests.filter(req => 
      req.url.includes('/api/images') && req.method === 'POST'
    );
    
    for (const request of imageRequests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.delete(request);
          console.log('[Service Worker] Synced image data:', request.url);
        }
      } catch (error) {
        console.error('[Service Worker] Image sync failed:', error.url, error);
      }
    }
    
    // Notify clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          dataType: 'images',
          count: imageRequests.length
        });
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Image sync error:', error);
  }
}

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const title = data.title || 'Nigeram Attendance';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/nigeram.png',
    badge: '/icons/badge.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Attendance'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Focus or open the app
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

// ========== PERIODIC SYNC ==========
// Request permission for periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    console.log('[Service Worker] Periodic sync triggered');
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Update static assets
    for (const asset of PRECACHE_ASSETS) {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          await cache.put(asset, response);
          console.log('[Service Worker] Updated cached asset:', asset);
        }
      } catch (error) {
        console.warn('[Service Worker] Failed to update asset:', asset, error);
      }
    }
    
    // Notify clients of update
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CACHE_UPDATED',
          timestamp: new Date().toISOString()
        });
      });
    });
    
  } catch (error) {
    console.error('[Service Worker] Periodic sync error:', error);
  }
}

// ========== MESSAGE HANDLING ==========
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        event.ports[0].postMessage({ success: true });
      })
      .catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
  }
  
  if (event.data && event.data.type === 'GET_CACHE_INFO') {
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.keys();
      })
      .then((requests) => {
        event.ports[0].postMessage({
          success: true,
          cacheName: CACHE_NAME,
          itemCount: requests.length,
          version: '2.0'
        });
      });
  }
});

// ========== ERROR HANDLING ==========
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// Log service worker lifecycle
console.log(`[Service Worker] ${APP_NAME} service worker loaded`);
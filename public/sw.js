const CACHE_NAME = 'ensemble-live-v5'
const scopeRoot = new URL('./', self.registration.scope).href

async function primeAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch(scopeRoot, { cache: 'reload' })
  if (!response.ok) throw new Error('Unable to cache app shell')

  const html = await response.clone().text()
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], scopeRoot))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href)

  await cache.put(scopeRoot, response)
  await cache.addAll([...new Set(assetUrls)])
}

self.addEventListener('install', (event) => {
  event.waitUntil(primeAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(scopeRoot, copy))
          return response
        })
        .catch(() => caches.match(scopeRoot, { ignoreVary: true })),
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(request)
            .then((response) => response.ok && caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())))
            .catch(() => undefined),
        )
        return cached
      }

      return fetch(request).then((response) => {
        if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        return response
      })
    }),
  )
})

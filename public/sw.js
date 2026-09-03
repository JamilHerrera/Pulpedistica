/*
 * Service worker de PulpeAnálisis — escrito a mano, sin Workbox.
 *
 * Estrategia principal: NETWORK-FIRST.
 * Es un panel de ventas, stock y deudas: un dato viejo hace tomar decisiones
 * equivocadas (vender algo agotado, cobrar un fiado ya pagado). Por eso la red
 * manda siempre, y el cache existe solo para que la app ABRA sin internet.
 *
 * Excepción deliberada: los archivos de /assets/ llevan un hash en el nombre
 * (index-Bn_WsgDT.js). Si el contenido cambia, cambia el nombre, así que ahí
 * el cache nunca puede quedar obsoleto y se sirve cache-first por velocidad.
 *
 * Lo que NUNCA se cachea: las peticiones a Supabase. Van a otro origen y este
 * service worker ni las intercepta, para que no quede ni un dato del negocio
 * guardado en el navegador.
 */

const CACHE = 'pulpeanalisis-v1'

// Rutas estables, sin hash en el nombre, que forman el esqueleto de la app.
const SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `cache.add` individual: si un archivo falla, no tumba la instalación entera.
      .then((cache) => Promise.all(SHELL.map((ruta) => cache.add(ruta).catch(() => {}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Borra versiones anteriores, incluidos los caches que dejó Workbox.
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

/** ¿Vale la pena guardar esta respuesta? */
function cacheable(res) {
  return res && res.ok && res.type === 'basic' && !res.redirected
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Otro origen (Supabase, Google Fonts): que lo maneje el navegador.
  if (url.origin !== self.location.origin) return

  // 1. Navegaciones → network-first, con el shell cacheado como respaldo.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (cacheable(res)) {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
          }
          return res
        })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          return (
            (await cache.match(req)) ||
            (await cache.match('/')) ||
            (await cache.match('/offline.html'))
          )
        }),
    )
    return
  }

  // 2. Archivos con hash → cache-first (el nombre cambia si cambia el contenido).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (cacheable(res)) {
              const copia = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copia))
            }
            return res
          }),
      ),
    )
    return
  }

  // 3. Resto de estáticos del sitio (iconos, manifest) → network-first.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (cacheable(res)) {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copia))
        }
        return res
      })
      .catch(() => caches.match(req)),
  )
})

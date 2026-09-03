/**
 * Registra el service worker de public/sw.js.
 *
 * Solo en producción: en desarrollo el service worker se interpondría entre
 * Vite y el navegador, y el recargado en caliente dejaría de ser fiable.
 * Para probarlo localmente hay que usar `npm run build && npm run preview`.
 */
export function registrarServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.error('No se pudo registrar el service worker:', e)
    })
  })
}

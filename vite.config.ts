import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

// En produccion Vercel resuelve /login con login.html; el dev server de Vite
// haria fallback a index.html, asi que replicamos la ruta para que dev y prod
// sirvan exactamente el mismo documento.
function loginRoute(): Plugin {
  return {
    name: 'login-route',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname] = (req.url ?? '').split('?')
        if (pathname === '/login' || pathname === '/login/') req.url = '/login.html'
        next()
      })
    },
  }
}

// El service worker y el manifest se escriben a mano en public/ (sw.js y
// manifest.webmanifest) en vez de generarlos con vite-plugin-pwa: asi el
// archivo versionado en el repo es exactamente el que sirve el sitio, y la
// estrategia de cache queda explicita y auditable en una sola pagina de codigo.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        login: fileURLToPath(new URL('login.html', import.meta.url)),
      },
    },
  },
  plugins: [react(), loginRoute()],
})

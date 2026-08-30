import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        login: fileURLToPath(new URL('login.html', import.meta.url)),
      },
    },
  },
  plugins: [
    react(),
    loginRoute(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'PulpeAnálisis',
        short_name: 'PulpeAnálisis',
        description: 'Sistema inteligente de rotación de inventarios y ventas express',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#070714',
        background_color: '#070714',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Sin esto el service worker responderia index.html a toda navegacion,
        // incluidas /login (documento propio) y las rutas que el middleware
        // debe resolver en el servidor con 404 o redirect.
        navigateFallbackDenylist: [/^\/login/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cjrmtkxsomfvnqmyxoax\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
})

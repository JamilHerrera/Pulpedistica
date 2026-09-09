import { defineConfig } from 'vitest/config'

// Config aparte de vite.config.ts para no mezclar la configuración del build
// con la de las pruebas.
export default defineConfig({
  test: {
    // Las pruebas cubren lógica pura (reglas del semáforo, caché): no
    // necesitan DOM, y en Node corren bastante más rápido.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'verbose',
  },
})

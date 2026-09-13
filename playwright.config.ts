import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de extremo a extremo, con un navegador de verdad.
 *
 * Son otra cosa que las de Vitest y no las reemplazan. Vitest prueba la lógica
 * pura aislada: dado este mensaje, ¿qué huella sale? Esto prueba lo que aquello
 * no puede tocar, que es justamente donde estuvieron casi todos los errores
 * reales de este proyecto: que la pantalla monte, que la sesión llegue, que el
 * capturador de errores enganche de verdad en un navegador.
 *
 * Corren contra el servidor de desarrollo y contra la base real, así que cada
 * prueba limpia lo que crea. Ver `e2e/apoyo.ts`.
 */

const PUERTO = 5173

export default defineConfig({
  testDir: './e2e',
  // Comparten la misma cuenta y la misma base: en paralelo se pisarían.
  workers: 1,
  fullyParallel: false,
  // Un `test.only` olvidado haría pasar el pipeline sin correr casi nada.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${PUERTO}`,
    // Solo de los intentos que fallan: guardar todo llena el disco rápido.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-HN',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

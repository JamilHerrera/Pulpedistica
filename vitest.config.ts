import { defineConfig } from 'vitest/config'

// Config aparte de vite.config.ts para no mezclar la configuración del build
// con la de las pruebas.
export default defineConfig({
  test: {
    // Las pruebas cubren lógica pura: no necesitan DOM y en Node van más rápido.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: 'verbose',

    coverage: {
      provider: 'v8',
      // json-summary es el que lee el evaluador; lcov sirve para SonarCloud
      // y text deja el resumen visible en la salida del pipeline.
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',

      // Se mide la CAPA DE LÓGICA: reglas de negocio, caché, idempotencia,
      // el middleware que protege /admin y la función de healthcheck.
      //
      // Quedan fuera las pantallas y los hooks de React. Probarlos exige
      // simular Supabase entero, y esas pruebas terminan verificando que el
      // simulacro devuelve lo que se le programó, no que la app funcione:
      // inflarían la cobertura sin agregar confianza.
      include: [
        'src/lib/**/*.ts',
        'api/**/*.ts',
        'middleware.ts',
      ],
      exclude: [
        '**/*.test.ts',
        // Solo crea el cliente de Supabase a partir de variables de entorno.
        'src/lib/supabase.ts',
      ],
    },
  },
})

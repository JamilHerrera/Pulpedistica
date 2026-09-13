import { test, expect } from '@playwright/test'
import {
  MARCA, entrarAlPanel, provocarError, esperarTicket, ticketsDePrueba, borrarRastro,
} from './apoyo'

/**
 * Que el capturador de errores funcione de verdad, en un navegador de verdad.
 *
 * Las pruebas de Vitest ya cubren la lógica: qué huella sale de un mensaje, qué
 * se considera ruido, qué se redacta. Pero todo aquello puede estar perfecto y
 * el sistema no capturar nada, porque lo que falla en un capturador es el
 * enganche: que el escucha no se instale, que se instale tarde, que React se
 * trague la excepción, que el token no viaje. Nada de eso se ve sin un
 * navegador.
 *
 * Cada prueba deja tickets reales en la base. Se borran al final por `MARCA`.
 */

test.afterAll(async () => {
  const borrados = await borrarRastro()
  console.log(`Limpieza: ${borrados} ticket(s) de prueba borrados.`)
})

test.describe('captura automática', () => {
  test('una promesa que nadie atrapa se convierte en ticket', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} promesa sin catch`

    await provocarError(page, async () => {
      await page.evaluate((m) => {
        // Exactamente lo que pasa cuando una consulta a Supabase se cae y
        // nadie la maneja: la fuente más común de fallos invisibles.
        void Promise.reject(new Error(m))
      }, mensaje)
    })

    const ticket = await esperarTicket(mensaje)
    expect(ticket).not.toBeNull()
    expect(ticket?.origen).toBe('promesa')
    expect(ticket?.veces).toBe(1)
  })

  test('una excepción suelta se convierte en ticket', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} excepcion suelta`

    await provocarError(page, async () => {
      await page.evaluate((m) => {
        setTimeout(() => { throw new Error(m) }, 0)
      }, mensaje)
    })

    const ticket = await esperarTicket(mensaje)
    expect(ticket).not.toBeNull()
    expect(ticket?.origen).toBe('javascript')
  })

  // Esta es la que hace que el sistema cubra la app entera: los 28
  // `console.error` que ya estaban escritos quedan capturados sin tocarlos.
  test('un console.error de los que ya estaban escritos deja ticket', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} fallo registrado por la app`

    await provocarError(page, async () => {
      await page.evaluate((m) => { console.error('Error registrando fiado:', new Error(m)) }, mensaje)
    })

    const ticket = await esperarTicket(mensaje)
    expect(ticket).not.toBeNull()
    expect(ticket?.origen).toBe('consola')
  })

  test('el ticket dice en qué pantalla estaba parado el usuario', async ({ page }) => {
    await entrarAlPanel(page)
    await page.locator('aside').getByRole('button', { name: 'Inventario' }).click()
    await expect(page).toHaveURL(/pantalla=inventario/)

    const mensaje = `${MARCA} fallo desde inventario`
    await provocarError(page, async () => {
      await page.evaluate((m) => { void Promise.reject(new Error(m)) }, mensaje)
    })

    const ticket = await esperarTicket(mensaje)
    expect(ticket?.pantalla).toBe('inventario')
    expect(ticket?.ruta).toContain('/admin')
  })

  test('el ruido del navegador NO genera ticket', async ({ page }) => {
    await entrarAlPanel(page)

    let hubieraReportado = false
    page.on('request', (r) => {
      if (r.url().includes('/rpc/reportar_error')) hubieraReportado = true
    })

    await page.evaluate(() => {
      void Promise.reject(new Error('ResizeObserver loop completed with undelivered notifications'))
    })
    await page.waitForTimeout(2000)

    expect(hubieraReportado).toBe(false)
  })
})

test.describe('defensas', () => {
  // Sin esto, un bug dentro de un efecto de React tumbaría la app del usuario
  // a fuerza de peticiones.
  test('el mismo error diez veces seguidas se manda una sola vez', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} error en bucle`

    let envios = 0
    page.on('request', (r) => {
      if (r.url().includes('/rpc/reportar_error')) envios++
    })

    await page.evaluate((m) => {
      for (let i = 0; i < 10; i++) void Promise.reject(new Error(m))
    }, mensaje)
    await page.waitForTimeout(3000)

    expect(envios).toBe(1)
    expect(await esperarTicket(mensaje)).not.toBeNull()
  })

  // Una traza arrastra lo que había en la petición que falló, y ahí puede ir
  // el token de sesión de quien lo sufrió. Un ticket lo lee soporte.
  test('el token de sesión nunca llega al ticket', async ({ page }) => {
    await entrarAlPanel(page)
    const jwtFalso = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3VhcmlvIn0.FirmaFalsaDePrueba'
    const mensaje = `${MARCA} fallo con credenciales`

    await provocarError(page, async () => {
      await page.evaluate(([m, jwt]) => {
        void Promise.reject(new Error(`${m}: Bearer ${jwt} rechazado para ana@pulperia.hn`))
      }, [mensaje, jwtFalso])
    })

    const ticket = await esperarTicket(mensaje)
    expect(ticket).not.toBeNull()
    expect(ticket?.titulo).not.toContain(jwtFalso)
    expect(ticket?.titulo).not.toContain('eyJ')
    expect(ticket?.titulo).not.toContain('ana@pulperia.hn')
    expect(ticket?.titulo).toContain('{token}')
  })

  // La app se usa donde el internet se cae seguido. Un error que ocurre justo
  // sin señal es tan real como cualquier otro.
  test('un error sin internet se guarda y se manda cuando vuelve', async ({ page, context }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} fallo sin senal`

    await context.setOffline(true)
    await page.evaluate((m) => { void Promise.reject(new Error(m)) }, mensaje)

    // Primero: quedó guardado en el navegador en vez de perderse.
    await expect.poll(async () =>
      await page.evaluate(() => JSON.parse(localStorage.getItem('pa_tickets_pendientes') ?? '[]').length),
    ).toBe(1)

    // Después: al volver la señal se manda solo, sin que el usuario haga nada.
    const enviado = page.waitForResponse((r) => r.url().includes('/rpc/reportar_error'))
    await context.setOffline(false)
    await enviado

    expect(await esperarTicket(mensaje)).not.toBeNull()
    await expect.poll(async () =>
      await page.evaluate(() => JSON.parse(localStorage.getItem('pa_tickets_pendientes') ?? '[]').length),
    ).toBe(0)
  })
})

test.describe('la pantalla en blanco', () => {
  /**
   * El peor fallo posible y el motivo de la barrera: si React revienta al
   * dibujar y nadie lo atrapa, desmonta el árbol entero y el usuario se queda
   * mirando una pantalla vacía, sin ni un mensaje.
   *
   * Se provoca devolviendo un producto con el nombre corrupto, que es un fallo
   * realista —una columna que cambia de tipo— y hace que React lance.
   */
  test('un error al dibujar no deja la pantalla vacía y abre ticket', async ({ page }) => {
    await entrarAlPanel(page)

    await page.route('**/rest/v1/productos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: '00000000-0000-4000-8000-000000000001',
          nombre: { [MARCA]: 'nombre corrupto' },
          stock_actual: 5,
          precio: 10,
          categoria_id: null,
        }]),
      })
    })

    await page.locator('aside').getByRole('button', { name: 'Inventario' }).click()

    // El usuario ve una explicación, no una pantalla vacía.
    await expect(page.getByText(/se rompió esta pantalla/i)).toBeVisible({ timeout: 15_000 })
    // Y el menú sigue vivo: puede irse a otra sección.
    await expect(page.locator('aside').getByRole('button', { name: 'Inicio' })).toBeVisible()

    const ticket = await esperarTicket(MARCA)
    expect(ticket).not.toBeNull()
    expect(ticket?.origen).toBe('render')
    // La traza incluye el árbol de componentes, que es lo primero que hace
    // falta para reproducirlo.
    expect(ticket?.detalle).toContain('Componentes')
  })

  test('cambiar de sección rearma la barrera sola', async ({ page }) => {
    await entrarAlPanel(page)

    await page.route('**/rest/v1/productos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: '00000000-0000-4000-8000-000000000002',
          nombre: { [MARCA]: 'otro nombre corrupto' },
          stock_actual: 1,
          precio: 1,
          categoria_id: null,
        }]),
      })
    })

    await page.locator('aside').getByRole('button', { name: 'Inventario' }).click()
    await expect(page.getByText(/se rompió esta pantalla/i)).toBeVisible({ timeout: 15_000 })

    await page.locator('aside').getByRole('button', { name: 'Inicio' }).click()
    await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()
    await expect(page.getByText(/se rompió esta pantalla/i)).toHaveCount(0)
  })
})

test.describe('la bandeja de soporte', () => {
  test('el ticket aparece en la pantalla de Tickets', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} visible en la bandeja`

    await provocarError(page, async () => {
      await page.evaluate((m) => { void Promise.reject(new Error(m)) }, mensaje)
    })
    await esperarTicket(mensaje)

    await page.locator('aside').getByRole('button', { name: 'Tickets' }).click()
    await expect(page.getByRole('heading', { level: 2, name: /tickets de errores/i })).toBeVisible()
    await expect(page.getByText(mensaje)).toBeVisible({ timeout: 15_000 })
  })

  test('soporte puede tomar y resolver un ticket', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} para resolver`

    await provocarError(page, async () => {
      await page.evaluate((m) => { void Promise.reject(new Error(m)) }, mensaje)
    })
    await esperarTicket(mensaje)

    await page.goto('/admin?pantalla=tickets')
    const tarjeta = page.locator('.glass-card').filter({ hasText: mensaje })
    await tarjeta.getByRole('button', { name: 'Resolver' }).click()

    await expect.poll(async () => {
      const t = (await ticketsDePrueba()).find((x) => x.titulo.includes('para resolver'))
      return t?.estado
    }, { timeout: 15_000 }).toBe('resuelto')
  })

  test('el detalle muestra la traza para poder depurar', async ({ page }) => {
    await entrarAlPanel(page)
    const mensaje = `${MARCA} con traza`

    await provocarError(page, async () => {
      await page.evaluate((m) => { void Promise.reject(new Error(m)) }, mensaje)
    })
    await esperarTicket(mensaje)

    await page.goto('/admin?pantalla=tickets')
    const tarjeta = page.locator('.glass-card').filter({ hasText: mensaje })
    await tarjeta.getByRole('button', { name: /detalle/i }).click()

    await expect(tarjeta.locator('pre')).toBeVisible()
    await expect(tarjeta.getByText(/navegador/i)).toBeVisible()
  })
})

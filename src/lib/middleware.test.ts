import { describe, it, expect, vi } from 'vitest'

/**
 * El middleware es el guardia de la puerta: decide si un visitante recibe el
 * documento de /admin o lo manda a iniciar sesión, y qué pasa con una ruta que
 * no existe. Si se rompe, un anónimo podría recibir el panel.
 *
 * `next()` de @vercel/edge solo existe dentro del entorno de Vercel, así que
 * acá se reemplaza por una respuesta reconocible que permite distinguir
 * "dejar pasar" de "redirigir" o "cortar con 404".
 */
vi.mock('@vercel/edge', () => ({
  next: () => new Response('DEJA_PASAR', { status: 200 }),
}))

const { default: middleware } = await import('../../middleware')

const pedir = (ruta: string, cookie?: string) =>
  middleware(
    new Request('https://www.jamilherreravargas.lat' + ruta, {
      headers: cookie ? { cookie } : {},
    }),
  )

describe('middleware · acceso a /admin', () => {
  it('redirige a login cuando no hay sesión', async () => {
    const res = await pedir('/admin')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('no entrega el contenido del panel al visitante anónimo', async () => {
    const res = await pedir('/admin')
    expect(await res.text()).not.toContain('DEJA_PASAR')
  })

  it('deja pasar cuando la cookie de sesión está presente', async () => {
    const res = await pedir('/admin', 'pa_session=1')
    expect(await res.text()).toBe('DEJA_PASAR')
  })

  it('no se deja engañar por una cookie de nombre parecido', async () => {
    const res = await pedir('/admin', 'otra_pa_session=1')
    expect(res.status).toBe(302)
  })

  it('reconoce la cookie aunque venga acompañada de otras', async () => {
    const res = await pedir('/admin', 'theme=dark; pa_session=1; otra=x')
    expect(await res.text()).toBe('DEJA_PASAR')
  })
})

describe('middleware · rutas conocidas', () => {
  it('deja pasar la portada y el login', async () => {
    expect(await (await pedir('/')).text()).toBe('DEJA_PASAR')
    expect(await (await pedir('/login')).text()).toBe('DEJA_PASAR')
  })

  it('ignora la barra final', async () => {
    expect(await (await pedir('/login/')).text()).toBe('DEJA_PASAR')
  })
})

describe('middleware · rutas inexistentes', () => {
  it('responde 404 de verdad, no un 200 con pantalla de error', async () => {
    const res = await pedir('/una-ruta-que-no-existe')
    expect(res.status).toBe(404)
  })

  it('devuelve una página propia y pide no indexarla', async () => {
    const res = await pedir('/otra-inventada')
    const html = await res.text()
    expect(html).toContain('Esta página no existe')
    expect(html).toContain('noindex')
  })
})

describe('middleware · lo que no debe interceptar', () => {
  it('deja que las funciones de /api se resuelvan solas', async () => {
    expect(await (await pedir('/api/health')).text()).toBe('DEJA_PASAR')
  })

  it('deja pasar los archivos estáticos por su extensión', async () => {
    expect(await (await pedir('/sw.js')).text()).toBe('DEJA_PASAR')
    expect(await (await pedir('/assets/index-abc123.js')).text()).toBe('DEJA_PASAR')
    expect(await (await pedir('/pwa-512.png')).text()).toBe('DEJA_PASAR')
  })
})

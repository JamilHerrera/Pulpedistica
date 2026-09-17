import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parsearCSP, permite, type Directivas } from './csp'

/**
 * Estas pruebas leen el `vercel.json` de verdad, no una copia.
 *
 * El fallo que las motiva: las fotos de producto se subían bien y la dirección
 * devolvía 200, pero `img-src` solo permitía el propio dominio y el navegador
 * las bloqueaba sin decir nada. Lo que faltaba no era código, era una línea de
 * configuración, y ninguna prueba la miraba.
 */

function cspDelSitio(): Directivas {
  const ruta = fileURLToPath(new URL('../../vercel.json', import.meta.url))
  const config = JSON.parse(readFileSync(ruta, 'utf8'))

  const cabeceras = config.headers.flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
  const csp = cabeceras.find((h: { key: string }) => h.key === 'Content-Security-Policy')

  expect(csp, 'el sitio tiene que declarar una CSP').toBeDefined()
  return parsearCSP(csp.value)
}

const SUPABASE = 'https://cjrmtkxsomfvnqmyxoax.supabase.co'

describe('parsearCSP', () => {
  it('parte la cabecera en directivas', () => {
    const d = parsearCSP("default-src 'self'; img-src 'self' data:")
    expect(d['default-src']).toEqual(["'self'"])
    expect(d['img-src']).toEqual(["'self'", 'data:'])
  })

  it('tolera espacios de más y el punto y coma final', () => {
    expect(parsearCSP("  img-src   'self'  data: ;  ")['img-src']).toEqual(["'self'", 'data:'])
  })
})

describe('permite', () => {
  const d = parsearCSP("default-src 'self'; img-src 'self' https://*.supabase.co")

  it('acepta un subdominio bajo el comodín', () => {
    expect(permite(d, 'img-src', SUPABASE)).toBe(true)
  })

  // Un comodín mal interpretado dejaría pasar un dominio de un atacante que
  // apenas contenga el nombre.
  it('NO acepta un dominio que solo se le parece', () => {
    expect(permite(d, 'img-src', 'https://supabase.co.atacante.com')).toBe(false)
    expect(permite(d, 'img-src', 'https://malo.com')).toBe(false)
  })

  it('cae a default-src cuando la directiva no está declarada', () => {
    expect(permite(d, 'media-src', "'self'")).toBe(true)
    expect(permite(d, 'media-src', SUPABASE)).toBe(false)
  })
})

describe('la CSP que sirve el sitio', () => {
  const csp = cspDelSitio()

  // El fallo original: la foto llegaba, y el navegador la tiraba.
  it('deja cargar las fotos de producto desde Supabase Storage', () => {
    expect(permite(csp, 'img-src', SUPABASE)).toBe(true)
  })

  it('deja hablar con la API y con realtime', () => {
    expect(permite(csp, 'connect-src', SUPABASE)).toBe(true)
    expect(permite(csp, 'connect-src', 'wss://cjrmtkxsomfvnqmyxoax.supabase.co')).toBe(true)
  })

  it('sigue permitiendo las imágenes propias y las incrustadas', () => {
    expect(csp['img-src']).toContain("'self'")
    expect(csp['img-src']).toContain('data:')
  })

  // Abrir img-src no debe convertirse en abrirlo todo.
  it('no afloja lo que no hacía falta aflojar', () => {
    expect(csp['script-src']).toEqual(["'self'"])
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(permite(csp, 'script-src', SUPABASE)).toBe(false)
  })
})

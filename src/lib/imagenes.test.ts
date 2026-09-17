import { describe, it, expect } from 'vitest'
import {
  tipoPermitido, extensionDe, rutaDeFoto, rutaDesdeUrl, motivoDeRechazo,
  TAMANO_MAX, DEPOSITO,
} from './imagenes'

const NEGOCIO = '9311cb67-6430-45b0-bd41-150d480632ae'
const PRODUCTO = 'd1626dcc-cf7f-43c8-9311-40ae8091b2be'

describe('tipoPermitido', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('acepta %s', (t) => {
    expect(tipoPermitido(t)).toBe(true)
  })

  it.each(['application/pdf', 'image/svg+xml', 'text/html', ''])('rechaza %s', (t) => {
    expect(tipoPermitido(t)).toBe(false)
  })

  // Un SVG es un documento que puede traer guiones adentro. No es una foto.
  it('rechaza SVG aunque el nombre diga imagen', () => {
    expect(tipoPermitido('image/svg+xml')).toBe(false)
  })
})

describe('extensionDe', () => {
  it.each([
    ['image/png', 'png'],
    ['image/webp', 'webp'],
    ['image/jpeg', 'jpg'],
  ])('%s termina en .%s', (tipo, esperado) => {
    expect(extensionDe(tipo)).toBe(esperado)
  })

  it('ante un tipo raro usa jpg en vez de quedarse sin extensión', () => {
    expect(extensionDe('image/heic')).toBe('jpg')
  })
})

describe('rutaDeFoto', () => {
  // Esto es lo que impide que una pulpería pise las fotos de otra: las
  // políticas de Storage comparan el primer tramo contra mi_negocio().
  it('el primer tramo es SIEMPRE el negocio', () => {
    const ruta = rutaDeFoto(NEGOCIO, PRODUCTO, 'image/webp', 1700000000000)
    expect(ruta.split('/')[0]).toBe(NEGOCIO)
  })

  it('incluye el producto y la extensión del tipo', () => {
    const ruta = rutaDeFoto(NEGOCIO, PRODUCTO, 'image/png', 1700000000000)
    expect(ruta).toContain(PRODUCTO)
    expect(ruta.endsWith('.png')).toBe(true)
  })

  // Sin esto el navegador y el service worker seguirían mostrando la anterior.
  it('reemplazar una foto da una ruta distinta', () => {
    const antes = rutaDeFoto(NEGOCIO, PRODUCTO, 'image/webp', 1700000000000)
    const despues = rutaDeFoto(NEGOCIO, PRODUCTO, 'image/webp', 1700000009999)
    expect(antes).not.toBe(despues)
  })
})

describe('rutaDesdeUrl', () => {
  it('recupera la ruta que hace falta para borrar la foto vieja', () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/${DEPOSITO}/${NEGOCIO}/${PRODUCTO}-17.webp`
    expect(rutaDesdeUrl(url)).toBe(`${NEGOCIO}/${PRODUCTO}-17.webp`)
  })

  it('descarta los parámetros de la dirección', () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/${DEPOSITO}/${NEGOCIO}/x.webp?v=2`
    expect(rutaDesdeUrl(url)).toBe(`${NEGOCIO}/x.webp`)
  })

  // Devolver null evita intentar borrar algo que no es nuestro.
  it.each([
    null,
    undefined,
    '',
    'https://ejemplo.com/una-foto-cualquiera.jpg',
    'https://abc.supabase.co/storage/v1/object/public/otro-deposito/x.webp',
  ])('devuelve null ante una dirección ajena (%s)', (url) => {
    expect(rutaDesdeUrl(url as string)).toBeNull()
  })
})

describe('motivoDeRechazo', () => {
  it('deja pasar una foto normal de teléfono', () => {
    expect(motivoDeRechazo('image/jpeg', 4 * 1024 * 1024)).toBeNull()
  })

  it('explica por qué no, en vez de fallar en silencio', () => {
    expect(motivoDeRechazo('application/pdf', 1000)).toMatch(/JPG, PNG o WebP/)
    expect(motivoDeRechazo('image/jpeg', TAMANO_MAX * 9)).toMatch(/pesada/)
  })
})

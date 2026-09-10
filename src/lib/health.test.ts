import { describe, it, expect } from 'vitest'
import handler from '../../api/health'

/**
 * El healthcheck es lo que consulta un monitor externo para saber si el sitio
 * responde. Debe ser idempotente —solo lee, nunca muta— y por eso rechaza
 * cualquier método que insinúe un cambio de estado.
 */

/** Respuesta de mentira que registra lo que el handler escribió. */
function respuestaFalsa() {
  const grabado: { codigo: number; cuerpo: unknown; cabeceras: Record<string, string> } = {
    codigo: 0,
    cuerpo: null,
    cabeceras: {},
  }
  const res = {
    status(codigo: number) {
      grabado.codigo = codigo
      return res
    },
    setHeader(nombre: string, valor: string) {
      grabado.cabeceras[nombre] = valor
    },
    json(cuerpo: unknown) {
      grabado.cuerpo = cuerpo
    },
  }
  return { res, grabado }
}

describe('GET /api/health', () => {
  it('responde 200 con el estado del servicio', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'GET' }, res)
    expect(grabado.codigo).toBe(200)
    expect(grabado.cuerpo).toMatchObject({ status: 'ok', service: 'pulpe-analisis' })
  })

  it('incluye una marca de tiempo válida', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'GET' }, res)
    const { timestamp } = grabado.cuerpo as { timestamp: string }
    expect(Number.isNaN(Date.parse(timestamp))).toBe(false)
  })

  it('acepta HEAD, que es igual de seguro que GET', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'HEAD' }, res)
    expect(grabado.codigo).toBe(200)
  })

  it('trata la ausencia de método como GET', () => {
    const { res, grabado } = respuestaFalsa()
    handler({}, res)
    expect(grabado.codigo).toBe(200)
  })

  it('no distingue mayúsculas en el método', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'get' }, res)
    expect(grabado.codigo).toBe(200)
  })
})

describe('métodos que no corresponden', () => {
  it('rechaza POST con 405 en vez de fingir que hizo algo', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'POST' }, res)
    expect(grabado.codigo).toBe(405)
  })

  it('anuncia qué métodos sí acepta, como manda HTTP', () => {
    const { res, grabado } = respuestaFalsa()
    handler({ method: 'DELETE' }, res)
    expect(grabado.cabeceras.Allow).toBe('GET, HEAD')
  })

  it('rechaza también PUT y PATCH', () => {
    for (const metodo of ['PUT', 'PATCH']) {
      const { res, grabado } = respuestaFalsa()
      handler({ method: metodo }, res)
      expect(grabado.codigo).toBe(405)
    }
  })
})

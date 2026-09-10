import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Sube por única vez los precios que quedaron en el navegador. La regla que
 * más importa: SOLO completa productos sin precio. Si pisara uno ya guardado,
 * un cache viejo de otra computadora revertiría una corrección hecha después.
 */

const seleccionados = vi.fn()
const actualizados: Array<{ id: string; precio: number }> = []
const actualizarError = { valor: null as null | { code: string } }

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: () => seleccionados() }),
      update: (cambio: { precio: number }) => ({
        eq: (_col: string, id: string) => {
          actualizados.push({ id, precio: cambio.precio })
          return Promise.resolve({ error: actualizarError.valor })
        },
      }),
    }),
  },
}))

const { migrarPreciosLocales } = await import('./migrarPrecios')

/** localStorage de mentira: en Node no existe. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial }
  return {
    getItem: (k: string) => datos[k] ?? null,
    setItem: (k: string, v: string) => { datos[k] = v },
    removeItem: (k: string) => { delete datos[k] },
    datos,
  }
}

let almacen: ReturnType<typeof almacenFalso>

function prepararAlmacen(inicial: Record<string, string> = {}) {
  almacen = almacenFalso(inicial)
  vi.stubGlobal('localStorage', almacen)
}

beforeEach(() => {
  actualizados.length = 0
  actualizarError.valor = null
  seleccionados.mockReset()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('migrarPreciosLocales', () => {
  it('no hace nada si la migración ya se corrió en este navegador', async () => {
    prepararAlmacen({ pulpe_precios_migrados: '1', pulpe_precios: '{"p1":10}' })
    await migrarPreciosLocales()
    expect(seleccionados).not.toHaveBeenCalled()
  })

  it('marca la migración como hecha cuando no hay precios guardados', async () => {
    prepararAlmacen({})
    await migrarPreciosLocales()
    expect(almacen.datos.pulpe_precios_migrados).toBe('1')
    expect(seleccionados).not.toHaveBeenCalled()
  })

  it('sube el precio de un producto que no lo tenía', async () => {
    prepararAlmacen({ pulpe_precios: '{"p1":12.5}' })
    seleccionados.mockResolvedValue({ data: [{ id: 'p1', precio: null }], error: null })

    await migrarPreciosLocales()

    expect(actualizados).toEqual([{ id: 'p1', precio: 12.5 }])
    expect(almacen.datos.pulpe_precios_migrados).toBe('1')
  })

  it('NUNCA pisa un precio que ya existe en la base', async () => {
    prepararAlmacen({ pulpe_precios: '{"p1":12.5,"p2":30}' })
    seleccionados.mockResolvedValue({
      data: [{ id: 'p1', precio: 99 }, { id: 'p2', precio: null }],
      error: null,
    })

    await migrarPreciosLocales()

    expect(actualizados).toEqual([{ id: 'p2', precio: 30 }])
  })

  it('ignora los precios en cero o negativos del cache', async () => {
    prepararAlmacen({ pulpe_precios: '{"p1":0,"p2":-5}' })
    await migrarPreciosLocales()
    expect(seleccionados).not.toHaveBeenCalled()
    expect(almacen.datos.pulpe_precios_migrados).toBe('1')
  })

  it('si la lectura falla NO marca la migración: se reintenta en la próxima sesión', async () => {
    prepararAlmacen({ pulpe_precios: '{"p1":12.5}' })
    seleccionados.mockResolvedValue({ data: null, error: { code: 'PGRST301' } })

    await migrarPreciosLocales()

    expect(almacen.datos.pulpe_precios_migrados).toBeUndefined()
  })

  it('si una escritura falla tampoco marca la migración', async () => {
    prepararAlmacen({ pulpe_precios: '{"p1":12.5}' })
    seleccionados.mockResolvedValue({ data: [{ id: 'p1', precio: null }], error: null })
    actualizarError.valor = { code: '42501' }

    await migrarPreciosLocales()

    expect(almacen.datos.pulpe_precios_migrados).toBeUndefined()
  })

  it('tolera un cache corrupto sin romper el arranque de la app', async () => {
    prepararAlmacen({ pulpe_precios: 'esto no es json' })
    await expect(migrarPreciosLocales()).resolves.toBeUndefined()
    expect(almacen.datos.pulpe_precios_migrados).toBe('1')
  })
})

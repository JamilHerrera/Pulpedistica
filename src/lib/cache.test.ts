import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { consultaCacheada, invalidar, limpiarCache, TTL } from './cache'

/**
 * Si la caché sirve datos que ya no valen, el dueño ve ventas o stock viejos
 * y decide sobre cifras equivocadas. Lo que más importa probar es que la
 * invalidación funcione: es lo que corre después de cada venta.
 */

beforeEach(() => {
  limpiarCache()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('consultaCacheada', () => {
  it('ejecuta la consulta la primera vez y devuelve su valor', async () => {
    const consulta = vi.fn().mockResolvedValue('ventas del día')
    await expect(consultaCacheada('k', consulta)).resolves.toBe('ventas del día')
    expect(consulta).toHaveBeenCalledTimes(1)
  })

  it('reusa lo cacheado sin volver a consultar', async () => {
    const consulta = vi.fn().mockResolvedValue(42)
    await consultaCacheada('k', consulta)
    await consultaCacheada('k', consulta)
    await consultaCacheada('k', consulta)
    expect(consulta).toHaveBeenCalledTimes(1)
  })

  it('comparte una sola petición entre llamadas simultáneas', async () => {
    // React monta los efectos dos veces en desarrollo y varias pantallas
    // piden lo mismo a la vez: sin esto se dispararían peticiones repetidas.
    let resolver: (v: string) => void = () => {}
    const consulta = vi.fn(() => new Promise<string>((r) => { resolver = r }))

    const a = consultaCacheada('k', consulta)
    const b = consultaCacheada('k', consulta)
    resolver('uno solo')

    expect(await a).toBe('uno solo')
    expect(await b).toBe('uno solo')
    expect(consulta).toHaveBeenCalledTimes(1)
  })

  it('vuelve a consultar cuando venció la ventana de validez', async () => {
    vi.useFakeTimers()
    const consulta = vi.fn().mockResolvedValue('x')
    await consultaCacheada('k', consulta, 1000)
    vi.advanceTimersByTime(1001)
    await consultaCacheada('k', consulta, 1000)
    expect(consulta).toHaveBeenCalledTimes(2)
  })

  it('no cachea un error: el siguiente intento vuelve a probar', async () => {
    const consulta = vi.fn()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue('recuperado')

    await expect(consultaCacheada('k', consulta)).rejects.toThrow('sin red')
    await expect(consultaCacheada('k', consulta)).resolves.toBe('recuperado')
    expect(consulta).toHaveBeenCalledTimes(2)
  })

  it('mantiene separadas las claves distintas', async () => {
    const uno = vi.fn().mockResolvedValue('ventas')
    const dos = vi.fn().mockResolvedValue('stock')
    expect(await consultaCacheada('ventas:hoy', uno)).toBe('ventas')
    expect(await consultaCacheada('stock:todo', dos)).toBe('stock')
    expect(uno).toHaveBeenCalledTimes(1)
    expect(dos).toHaveBeenCalledTimes(1)
  })
})

describe('invalidar', () => {
  it('descarta las claves que empiezan con el prefijo', async () => {
    const consulta = vi.fn().mockResolvedValue('v')
    await consultaCacheada('dashboard:hoy', consulta)
    invalidar('dashboard')
    await consultaCacheada('dashboard:hoy', consulta)
    expect(consulta).toHaveBeenCalledTimes(2)
  })

  it('no toca las claves de otro prefijo', async () => {
    const dash = vi.fn().mockResolvedValue('d')
    const inv = vi.fn().mockResolvedValue('i')
    await consultaCacheada('dashboard:hoy', dash)
    await consultaCacheada('inventario:listado', inv)

    invalidar('dashboard')

    await consultaCacheada('dashboard:hoy', dash)
    await consultaCacheada('inventario:listado', inv)
    expect(dash).toHaveBeenCalledTimes(2)
    expect(inv).toHaveBeenCalledTimes(1)
  })

  it('acepta varios prefijos a la vez, como después de una venta', async () => {
    const a = vi.fn().mockResolvedValue(1)
    const b = vi.fn().mockResolvedValue(2)
    await consultaCacheada('ventas:x', a)
    await consultaCacheada('productos:y', b)

    invalidar('ventas', 'productos')

    await consultaCacheada('ventas:x', a)
    await consultaCacheada('productos:y', b)
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(2)
  })
})

describe('limpiarCache', () => {
  it('borra todo, para no filtrar datos entre cuentas al cerrar sesión', async () => {
    const consulta = vi.fn().mockResolvedValue('privado')
    await consultaCacheada('fiados:listado', consulta)
    limpiarCache()
    await consultaCacheada('fiados:listado', consulta)
    expect(consulta).toHaveBeenCalledTimes(2)
  })
})

describe('TTL', () => {
  it('ordena las ventanas de menor a mayor', () => {
    expect(TTL.corto).toBeLessThan(TTL.medio)
    expect(TTL.medio).toBeLessThan(TTL.largo)
  })
})

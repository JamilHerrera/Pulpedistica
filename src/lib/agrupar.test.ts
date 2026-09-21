import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { agruparLlamadas } from './agrupar'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('agruparLlamadas', () => {
  // El caso que motiva el archivo: una venta de cinco productos llega como
  // once eventos, y tiene que producir UNA recarga, no once.
  it('una ráfaga de avisos produce un solo refresco', () => {
    const fn = vi.fn()
    const { disparar } = agruparLlamadas(fn, 500, 3000)

    for (let i = 0; i < 11; i++) disparar()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('espera a que los avisos paren', () => {
    const fn = vi.fn()
    const { disparar } = agruparLlamadas(fn, 500, 3000)

    disparar()
    vi.advanceTimersByTime(400)
    disparar()
    vi.advanceTimersByTime(400)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
  })

  // Sin el tope, una corriente continua de ventas dejaría la pantalla
  // congelada esperando un silencio que no llega nunca.
  it('una corriente continua refresca igual cada maxEspera', () => {
    const fn = vi.fn()
    const { disparar } = agruparLlamadas(fn, 500, 2000)

    for (let t = 0; t < 6000; t += 100) {
      disparar()
      vi.advanceTimersByTime(100)
    }
    // 6 segundos de avisos cada 100 ms, con tope de 2 s: unos 3 refrescos,
    // no 60 y tampoco cero.
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(fn.mock.calls.length).toBeLessThanOrEqual(4)
  })

  it('después de refrescar, un aviso nuevo arranca otra ráfaga', () => {
    const fn = vi.fn()
    const { disparar } = agruparLlamadas(fn, 500, 3000)

    disparar()
    vi.advanceTimersByTime(500)
    disparar()
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancelar descarta lo pendiente, para no refrescar una pantalla cerrada', () => {
    const fn = vi.fn()
    const { disparar, cancelar } = agruparLlamadas(fn, 500, 3000)

    disparar()
    cancelar()
    vi.advanceTimersByTime(5000)
    expect(fn).not.toHaveBeenCalled()
  })
})

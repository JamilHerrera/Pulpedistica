import { describe, it, expect } from 'vitest'
import { claveDia, inicioDelDia, ultimosDias } from './fechas'

describe('claveDia', () => {
  it('arma la clave del día local', () => {
    expect(claveDia(new Date(2026, 8, 5, 10, 0))).toBe('2026-09-05')
  })

  // El error que motivó el archivo: una venta de las 7 de la noche no puede
  // caer en el día siguiente.
  it('una venta de la noche sigue siendo del mismo día', () => {
    expect(claveDia(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05')
  })

  it('rellena mes y día con cero', () => {
    expect(claveDia(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('inicioDelDia', () => {
  it('lleva a medianoche sin tocar la fecha original', () => {
    const original = new Date(2026, 8, 5, 18, 30)
    const inicio = inicioDelDia(original)
    expect(inicio.getHours()).toBe(0)
    expect(original.getHours()).toBe(18)
  })
})

describe('ultimosDias', () => {
  it('devuelve n días, del más viejo a hoy', () => {
    const dias = ultimosDias(7, new Date(2026, 8, 10, 15))
    expect(dias).toHaveLength(7)
    expect(claveDia(dias[0])).toBe('2026-09-04')
    expect(claveDia(dias[6])).toBe('2026-09-10')
  })

  it('cruza el cambio de mes por calendario', () => {
    const dias = ultimosDias(3, new Date(2026, 9, 1))
    expect(dias.map(claveDia)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01'])
  })

  it('cero o negativo es una lista vacía, no un error', () => {
    expect(ultimosDias(0)).toEqual([])
    expect(ultimosDias(-3)).toEqual([])
  })
})

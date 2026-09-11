import { describe, it, expect } from 'vitest'
import { mensajeValido, promedioCalificacion, sinAtender, MENSAJE_MIN, MENSAJE_MAX } from './feedback'
import type { Feedback } from '../types'

const comentario = (parcial: Partial<Feedback>): Feedback => ({
  id: 'x', user_id: 'u', negocio_id: null, tipo: 'sugerencia',
  calificacion: null, mensaje: 'un comentario', pantalla: null,
  atendido: false, created_at: new Date().toISOString(),
  ...parcial,
})

describe('mensajeValido', () => {
  it('rechaza un mensaje demasiado corto', () => {
    expect(mensajeValido('corto')).toBe(false)
  })

  it('acepta justo en el mínimo', () => {
    expect(mensajeValido('a'.repeat(MENSAJE_MIN))).toBe(true)
  })

  it('no cuenta los espacios de los extremos', () => {
    // Diez espacios y dos letras no son un comentario de doce caracteres.
    expect(mensajeValido('          ab')).toBe(false)
  })

  it('rechaza pasarse del máximo', () => {
    expect(mensajeValido('a'.repeat(MENSAJE_MAX + 1))).toBe(false)
    expect(mensajeValido('a'.repeat(MENSAJE_MAX))).toBe(true)
  })
})

describe('promedioCalificacion', () => {
  it('devuelve null cuando ninguno trae puntaje', () => {
    expect(promedioCalificacion([comentario({}), comentario({})])).toBeNull()
  })

  it('ignora los comentarios sin puntaje en vez de contarlos como cero', () => {
    // Con 4 y 2, el promedio es 3. Si el sin-nota contara como 0, daria 2.
    const lista = [
      comentario({ calificacion: 4 }),
      comentario({ calificacion: 2 }),
      comentario({ calificacion: null }),
    ]
    expect(promedioCalificacion(lista)).toBe(3)
  })

  it('promedia bien un solo comentario', () => {
    expect(promedioCalificacion([comentario({ calificacion: 5 })])).toBe(5)
  })
})

describe('sinAtender', () => {
  it('cuenta solo los pendientes', () => {
    const lista = [
      comentario({ atendido: false }),
      comentario({ atendido: true }),
      comentario({ atendido: false }),
    ]
    expect(sinAtender(lista)).toBe(2)
  })

  it('devuelve cero con la lista vacia', () => {
    expect(sinAtender([])).toBe(0)
  })
})

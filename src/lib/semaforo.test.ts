import { describe, it, expect } from 'vitest'
import {
  calcularNivel,
  sinMovimiento,
  etiquetaUmbral,
  UMBRALES,
  ORDEN_NIVELES,
} from './semaforo'

/**
 * El semáforo decide qué repone la pulpería y qué está por estancarse. Un
 * umbral corrido en uno hace que el dueño compre lo que no se vende y deje
 * de comprar lo que sí. Por eso las pruebas se concentran en los BORDES de
 * cada rango, que es donde se esconden esos errores.
 */

describe('calcularNivel', () => {
  it('clasifica como baja un producto sin ninguna venta', () => {
    expect(calcularNivel(0, 7)).toBe('baja')
    expect(calcularNivel(0, 15)).toBe('baja')
    expect(calcularNivel(0, 30)).toBe('baja')
  })

  it('clasifica como alta al alcanzar justo el umbral en 7 días', () => {
    expect(calcularNivel(7, 7)).toBe('alta')
  })

  it('no llega a alta con una unidad menos que el umbral', () => {
    expect(calcularNivel(6, 7)).toBe('media')
    expect(calcularNivel(11, 15)).toBe('media')
    expect(calcularNivel(19, 30)).toBe('media')
  })

  it('clasifica como media al alcanzar justo el umbral medio', () => {
    expect(calcularNivel(3, 7)).toBe('media')
    expect(calcularNivel(5, 15)).toBe('media')
    expect(calcularNivel(7, 30)).toBe('media')
  })

  it('cae a baja con una unidad menos que el umbral medio', () => {
    expect(calcularNivel(2, 7)).toBe('baja')
    expect(calcularNivel(4, 15)).toBe('baja')
    expect(calcularNivel(6, 30)).toBe('baja')
  })

  it('exige más unidades para el mismo nivel cuando la ventana es más larga', () => {
    // 10 unidades es buena rotación en una semana, pero mediocre en un mes.
    expect(calcularNivel(10, 7)).toBe('alta')
    expect(calcularNivel(10, 30)).toBe('media')
  })

  it('mantiene el nivel alto por encima del umbral', () => {
    expect(calcularNivel(999, 7)).toBe('alta')
    expect(calcularNivel(999, 30)).toBe('alta')
  })
})

describe('sinMovimiento', () => {
  it('marca sin movimiento solo cuando no hubo ventas', () => {
    expect(sinMovimiento(0)).toBe(true)
    expect(sinMovimiento(1)).toBe(false)
  })
})

describe('UMBRALES', () => {
  it('define el umbral alto por encima del medio en los tres períodos', () => {
    for (const dias of [7, 15, 30] as const) {
      expect(UMBRALES[dias].alta).toBeGreaterThan(UMBRALES[dias].media)
    }
  })

  it('ordena los niveles de mejor a peor rotación', () => {
    expect(ORDEN_NIVELES).toEqual(['alta', 'media', 'baja'])
  })
})

describe('etiquetaUmbral', () => {
  it('describe cada rango sin dejar huecos ni solapes', () => {
    // La leyenda de la pantalla sale de acá: si no coincide con la regla,
    // el usuario lee un número y ve otro comportamiento.
    expect(etiquetaUmbral('alta', 30)).toBe('≥ 20 uds')
    expect(etiquetaUmbral('media', 30)).toBe('7–19 uds')
    expect(etiquetaUmbral('baja', 30)).toBe('1–6 uds')
  })

  it('coincide con lo que realmente devuelve calcularNivel', () => {
    // Recorre todos los valores del rango y verifica que el nivel calculado
    // sea el que la leyenda promete.
    for (const dias of [7, 15, 30] as const) {
      const { alta, media } = UMBRALES[dias]
      expect(calcularNivel(alta, dias)).toBe('alta')
      expect(calcularNivel(alta - 1, dias)).toBe('media')
      expect(calcularNivel(media, dias)).toBe('media')
      expect(calcularNivel(media - 1, dias)).toBe('baja')
    }
  })
})

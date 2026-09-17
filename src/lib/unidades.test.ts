import { describe, it, expect } from 'vitest'
import {
  UNIDADES, esFraccionable, reglaDe, redondearCantidad, cantidadValida,
  sumarPaso, formatearCantidad, subtotalDeLinea, totalDeVenta,
  interpretarCantidad, CANTIDAD_MAX,
} from './unidades'

describe('esFraccionable', () => {
  it('lo que se pesa admite media libra', () => {
    expect(esFraccionable('libra')).toBe(true)
    expect(esFraccionable('kilo')).toBe(true)
  })

  it('lo que se cuenta no: no existe medio cartón de huevos', () => {
    expect(esFraccionable('unidad')).toBe(false)
  })

  // Si la base gana un valor nuevo antes que la app, o una fila vieja quedó
  // vacía, conviene el comportamiento más restrictivo.
  it.each([null, undefined, 'galones' as never])('ante una unidad desconocida (%s) no fracciona', (u) => {
    expect(esFraccionable(u)).toBe(false)
    expect(reglaDe(u)).toBe(UNIDADES.unidad)
  })
})

describe('redondearCantidad', () => {
  it('deja pasar los cuartos de libra', () => {
    expect(redondearCantidad(0.25, 'libra')).toBe(0.25)
    expect(redondearCantidad(2.75, 'libra')).toBe(2.75)
  })

  it('corta los decimales de lo que se cuenta', () => {
    expect(redondearCantidad(2.9, 'unidad')).toBe(2)
    expect(redondearCantidad(3, 'unidad')).toBe(3)
  })

  it('redondea a tres decimales, como la columna de la base', () => {
    expect(redondearCantidad(0.12345, 'libra')).toBe(0.123)
  })

  it.each([NaN, Infinity, -Infinity])('devuelve cero ante un valor imposible (%s)', (v) => {
    expect(redondearCantidad(v, 'libra')).toBe(0)
  })

  // El motivo de redondear multiplicando en vez de confiar en el binario.
  it('no arrastra el resto de la suma binaria', () => {
    expect(redondearCantidad(0.1 + 0.2, 'libra')).toBe(0.3)
  })
})

describe('cantidadValida', () => {
  it('acepta media libra de queso', () => {
    expect(cantidadValida(0.5, 'libra')).toBe(true)
  })

  it('rechaza medio cartón de huevos', () => {
    expect(cantidadValida(0.5, 'unidad')).toBe(false)
    expect(cantidadValida(2, 'unidad')).toBe(true)
  })

  it.each([0, -1, NaN])('rechaza una cantidad sin sentido (%s)', (v) => {
    expect(cantidadValida(v, 'libra')).toBe(false)
  })

  it('rechaza un dedazo enorme', () => {
    expect(cantidadValida(CANTIDAD_MAX, 'libra')).toBe(true)
    expect(cantidadValida(CANTIDAD_MAX + 1, 'libra')).toBe(false)
  })
})

describe('sumarPaso', () => {
  it('lo que se cuenta sube de a uno', () => {
    expect(sumarPaso(3, 'unidad', 1)).toBe(4)
    expect(sumarPaso(3, 'unidad', -1)).toBe(2)
  })

  it('lo que se pesa sube de a cuarto de libra', () => {
    expect(sumarPaso(1, 'libra', 1)).toBe(1.25)
    expect(sumarPaso(1, 'libra', -1)).toBe(0.75)
  })

  it('nunca baja de cero', () => {
    expect(sumarPaso(0.25, 'libra', -1)).toBe(0)
    expect(sumarPaso(0, 'unidad', -5)).toBe(0)
  })

  it('cuatro toques hacen una libra justa, sin resto', () => {
    let cantidad = 0
    for (let i = 0; i < 4; i++) cantidad = sumarPaso(cantidad, 'libra', 1)
    expect(cantidad).toBe(1)
  })
})

describe('formatearCantidad', () => {
  it('pone la abreviatura solo donde aporta', () => {
    expect(formatearCantidad(2.5, 'libra')).toBe('2.5 lb')
    expect(formatearCantidad(1.5, 'kilo')).toBe('1.5 kg')
    // "3 huevos" se lee mejor que "3 un".
    expect(formatearCantidad(3, 'unidad')).toBe('3')
  })

  it('no rellena con ceros que nadie necesita leer', () => {
    expect(formatearCantidad(2.5, 'libra')).not.toContain('2.500')
    expect(formatearCantidad(1, 'libra')).toBe('1 lb')
  })

  it('escribe los cuartos como se piden en el mostrador', () => {
    expect(formatearCantidad(0.25, 'libra')).toBe('0.25 lb')
    expect(formatearCantidad(0.75, 'libra')).toBe('0.75 lb')
  })

  // Truncar es una regla de ENTRADA, no de presentación. Si una consulta no
  // trajo la columna `unidad`, mostrar 2 donde hay 2.5 escondería existencias
  // reales; el lugar donde se impide teclear medio cartón es `cantidadValida`.
  it('muestra lo que hay aunque la unidad diga que no debería haber decimales', () => {
    expect(formatearCantidad(2.5, 'unidad')).toBe('2.5')
    expect(formatearCantidad(2.5, null)).toBe('2.5')
  })

  it('no explota ante un valor imposible', () => {
    expect(formatearCantidad(NaN, 'libra')).toBe('0')
  })
})

describe('subtotalDeLinea', () => {
  it('cobra media libra a mitad de precio', () => {
    expect(subtotalDeLinea(0.5, 25)).toBe(12.5)
  })

  it('redondea al centavo, que es lo que existe en la caja', () => {
    expect(subtotalDeLinea(0.333, 10)).toBe(3.33)
  })

  it.each([
    [NaN, 10],
    [1, NaN],
  ])('devuelve cero si algún dato no es un número (%s, %s)', (c, p) => {
    expect(subtotalDeLinea(c, p)).toBe(0)
  })
})

describe('totalDeVenta', () => {
  it('suma líneas de peso y de unidad en la misma venta', () => {
    expect(totalDeVenta([
      { cantidad: 2.5, precio_unitario: 25 },   // 62.50
      { cantidad: 3,   precio_unitario: 90 },   // 270.00
    ])).toBe(332.5)
  })

  it('vacío es cero, no NaN', () => {
    expect(totalDeVenta([])).toBe(0)
  })

  // El motivo de redondear cada línea antes de sumarlas: si cada una arrastra
  // su resto, el total no coincide con lo que el cliente suma a mano.
  it('el total coincide con la suma de los subtotales mostrados', () => {
    const lineas = [
      { cantidad: 0.1, precio_unitario: 0.2 },
      { cantidad: 0.1, precio_unitario: 0.2 },
      { cantidad: 0.1, precio_unitario: 0.2 },
    ]
    const mostrados = lineas.map((l) => subtotalDeLinea(l.cantidad, l.precio_unitario))
    expect(totalDeVenta(lineas)).toBe(Math.round(mostrados.reduce((a, b) => a + b, 0) * 100) / 100)
  })
})

describe('interpretarCantidad', () => {
  it('entiende el punto y la coma como separador decimal', () => {
    expect(interpretarCantidad('0.5', 'libra')).toBe(0.5)
    expect(interpretarCantidad('0,5', 'libra')).toBe(0.5)
  })

  it('ignora los espacios de alrededor', () => {
    expect(interpretarCantidad('  2.25  ', 'libra')).toBe(2.25)
  })

  it.each(['', '   ', 'medio', 'abc', '-3', '0'])('devuelve null ante "%s"', (texto) => {
    expect(interpretarCantidad(texto, 'libra')).toBeNull()
  })

  it('en un producto por unidad, "2.5" no se acepta a medias: se rechaza', () => {
    // Truncar a 2 en silencio cobraría algo distinto de lo que se tecleó.
    expect(interpretarCantidad('2.5', 'unidad')).toBe(2)
    expect(interpretarCantidad('0.5', 'unidad')).toBeNull()
  })
})

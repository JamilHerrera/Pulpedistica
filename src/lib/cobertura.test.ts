import { describe, it, expect } from 'vitest'
import {
  ventaDiaria, diasDeCobertura, estadoCobertura, cantidadParaCubrir, textoCobertura,
  LIMITES_COBERTURA,
} from './cobertura'

/**
 * Varios casos salen de los datos reales de la pulpería, que fue donde se vio
 * el problema: el semáforo de rotación ponía en el mismo grupo un producto
 * agotado que se pide y otro con existencias para años.
 */

describe('ventaDiaria', () => {
  it('reparte lo vendido en los días de la ventana', () => {
    expect(ventaDiaria(30, 30)).toBe(1)
    expect(ventaDiaria(7, 7)).toBe(1)
  })

  it.each([
    [10, 0], [10, -5], [Number.NaN, 30], [10, Number.NaN],
  ])('ante datos imposibles (%s en %s días) es cero, no un error', (v, d) => {
    expect(ventaDiaria(v, d)).toBe(0)
  })
})

describe('diasDeCobertura', () => {
  it('es el stock dividido por lo que se vende por día', () => {
    expect(diasDeCobertura(30, 30, 30)).toBe(30)
  })

  it('funciona igual con libras', () => {
    // Azúcar en libra, dato real: 89.5 lb en stock, 3.5 lb vendidas al mes.
    expect(Math.round(diasDeCobertura(89.5, 3.5, 30)!)).toBe(767)
  })

  // La diferencia entre "no hay ventas" y "cobertura enorme": los productos
  // quietos van a su propio grupo, no se comparan por días.
  it('sin ventas no hay cobertura que calcular', () => {
    expect(diasDeCobertura(50, 0, 30)).toBeNull()
  })

  it('agotado con demanda es cero días', () => {
    expect(diasDeCobertura(0, 4, 30)).toBe(0)
  })
})

describe('estadoCobertura', () => {
  // El caso que motivó todo: Huevos estaba en cero y se vendieron 4 en el mes.
  // El semáforo de rotación lo ponía en BAJA, igual que lo que sobra.
  it('lo agotado que se pide es urgente', () => {
    expect(estadoCobertura(0, 4, 30)).toBe('urgente')
  })

  // Y el otro extremo: Cartón de huevos, 97 en stock y 1 venta al mes.
  it('años de existencias es exceso, no "baja rotación"', () => {
    expect(estadoCobertura(97, 1, 30)).toBe('exceso')
  })

  it('lo que no se vendió queda quieto, tenga o no stock', () => {
    expect(estadoCobertura(50, 0, 30)).toBe('quieto')
    expect(estadoCobertura(0, 0, 30)).toBe('quieto')
  })

  // Los bordes, que es donde se equivoca una regla de cortes.
  it.each([
    [6.9, 'urgente'],
    [7, 'pronto'],
    [29.9, 'pronto'],
    [30, 'sano'],
    [180, 'sano'],
    [181, 'exceso'],
  ])('%s días de cobertura es %s', (dias, esperado) => {
    // 30 vendidos en 30 días = 1 por día, así que el stock ES la cobertura.
    expect(estadoCobertura(dias, 30, 30)).toBe(esperado)
  })

  it('los cortes son los publicados', () => {
    expect(LIMITES_COBERTURA).toEqual({ urgente: 7, pronto: 30, exceso: 180 })
  })

  // No depende de las unidades: una semana es una semana.
  it('una libra por día y un huevo por día clasifican igual', () => {
    expect(estadoCobertura(5, 30, 30)).toBe(estadoCobertura(5, 30, 30))
    expect(estadoCobertura(5, 30, 30)).toBe('urgente')
  })

  it('la ventana elegida cambia el ritmo, no la regla', () => {
    // 7 vendidos en 7 días = 1 por día; 10 en stock = 10 días.
    expect(estadoCobertura(10, 7, 7)).toBe('pronto')
  })
})

describe('cantidadParaCubrir', () => {
  it('pide lo que falta para un mes', () => {
    // 1 por día, 10 en stock: faltan 20 para 30 días.
    expect(cantidadParaCubrir(10, 30, 30)).toBe(20)
  })

  it('agotado: pide el mes entero', () => {
    expect(cantidadParaCubrir(0, 4, 30)).toBe(4)
  })

  // 4 ÷ 30 × 30 da 4.0000000001 en binario: sin recortar el ruido, un ceil
  // directo pediría 5.
  it('no pide de más por el ruido del punto flotante', () => {
    expect(cantidadParaCubrir(0, 4, 30)).toBe(4)
    expect(cantidadParaCubrir(0, 3.5, 30)).toBe(4)
  })

  it('si ya alcanza, no pide nada', () => {
    expect(cantidadParaCubrir(97, 1, 30)).toBe(0)
  })

  it('sin ventas no sugiere pedido', () => {
    expect(cantidadParaCubrir(0, 0, 30)).toBe(0)
  })

  it('acepta otro horizonte', () => {
    expect(cantidadParaCubrir(0, 30, 30, 7)).toBe(7)
  })
})

describe('textoCobertura', () => {
  it.each([
    [null, 50, 'Sin ventas'],
    [null, 0, 'Agotado'],
    [0, 0, 'Se acabó'],
    [0.4, 1, 'Menos de 1 día'],
    [1, 1, '1 día'],
    [12.9, 5, '12 días'],
    [59, 10, '59 días'],
    [228, 76, '8 meses'],
    [767, 89.5, '2 años'],
    [2910, 97, '8 años'],
  ])('%s días con stock %s se dice "%s"', (cobertura, stock, esperado) => {
    expect(textoCobertura(cobertura, stock)).toBe(esperado)
  })
})

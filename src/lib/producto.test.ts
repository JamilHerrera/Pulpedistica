import { describe, it, expect } from 'vitest'
import {
  validarProducto, interpretarPrecio, claveDeNombre, nombreRepetido,
  cambiosDeProducto, erroresDe, NOMBRE_MAX, PRECIO_MAX,
  type CamposProducto, type ValoresProducto,
} from './producto'

const base: CamposProducto = {
  nombre: 'Azúcar en libra',
  precio: '15',
  stock: '10',
  unidad: 'libra',
  categoria_id: null,
}

describe('interpretarPrecio', () => {
  // Vacío no es cero: un producto sin precio es un estado válido del catálogo,
  // y la app lo muestra como "tocá para ponerle precio".
  it('vacío significa sin precio, no cero', () => {
    expect(interpretarPrecio('')).toBeNull()
    expect(interpretarPrecio('   ')).toBeNull()
    expect(interpretarPrecio('0')).toBe(0)
  })

  it('acepta la coma como separador decimal', () => {
    expect(interpretarPrecio('12,50')).toBe(12.5)
    expect(interpretarPrecio('12.50')).toBe(12.5)
  })

  it('redondea al centavo, que es lo que acepta la columna', () => {
    expect(interpretarPrecio('12.999')).toBe(13)
  })

  it.each(['-1', 'abc', String(PRECIO_MAX + 1)])('rechaza "%s"', (t) => {
    expect(interpretarPrecio(t)).toBe('invalido')
  })
})

describe('validarProducto', () => {
  it('convierte lo escrito en lo que se guarda', () => {
    const r = validarProducto(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valores).toEqual({
        nombre: 'Azúcar en libra',
        precio: 15,
        stock_actual: 10,
        unidad: 'libra',
        categoria_id: null,
      })
    }
  })

  it('recorta los espacios del nombre', () => {
    const r = validarProducto({ ...base, nombre: '  Arroz 1 lb  ' })
    expect(r.ok && r.valores.nombre).toBe('Arroz 1 lb')
  })

  it('un nombre vacío no pasa', () => {
    const r = validarProducto({ ...base, nombre: '   ' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.nombre).toMatch(/nombre/i)
  })

  it('un nombre larguísimo no pasa', () => {
    const r = validarProducto({ ...base, nombre: 'x'.repeat(NOMBRE_MAX + 1) })
    expect(r.ok).toBe(false)
  })

  // El stock respeta la unidad, igual que en todo el resto de la app.
  it('media libra es una existencia válida', () => {
    const r = validarProducto({ ...base, stock: '2.5', unidad: 'libra' })
    expect(r.ok && r.valores.stock_actual).toBe(2.5)
  })

  it('medio cartón de huevos no: se trunca', () => {
    const r = validarProducto({ ...base, stock: '2.5', unidad: 'unidad' })
    expect(r.ok && r.valores.stock_actual).toBe(2)
  })

  it('cero es una existencia válida: es un producto agotado', () => {
    const r = validarProducto({ ...base, stock: '0' })
    expect(r.ok && r.valores.stock_actual).toBe(0)
  })

  it.each(['', '  ', '-3', 'abc'])('rechaza una existencia de "%s"', (stock) => {
    const r = validarProducto({ ...base, stock })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.stock).toBeDefined()
  })

  // Un <select> sin elegir devuelve cadena vacía, y mandarla rompería la
  // llave foránea a categorias.
  it('sin categoría se guarda como null, no como cadena vacía', () => {
    const r = validarProducto({ ...base, categoria_id: '' })
    expect(r.ok && r.valores.categoria_id).toBeNull()
  })

  it('junta todos los errores, no solo el primero', () => {
    const r = validarProducto({ ...base, nombre: '', precio: 'abc', stock: '-1' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errores).sort()).toEqual(['nombre', 'precio', 'stock'])
  })
})

describe('erroresDe', () => {
  it('un resultado válido no tiene errores', () => {
    expect(erroresDe(validarProducto(base))).toEqual({})
  })

  it('devuelve los errores cuando hay', () => {
    const errores = erroresDe(validarProducto({ ...base, precio: 'abc' }))
    expect(errores.precio).toBeDefined()
  })
})

describe('claveDeNombre', () => {
  // Tiene que coincidir con el índice único de la base, que es
  // lower(trim(nombre)) — si no, el aviso diría una cosa y la base otra.
  it('ignora mayúsculas y espacios de los extremos', () => {
    expect(claveDeNombre('  AZÚCAR  ')).toBe(claveDeNombre('azúcar'))
  })
})

describe('nombreRepetido', () => {
  const productos = [
    { id: '1', nombre: 'Azúcar en libra' },
    { id: '2', nombre: 'Arroz 1 lb' },
  ]

  it('detecta el repetido sin importar mayúsculas ni espacios', () => {
    expect(nombreRepetido('  azúcar EN libra ', productos)).toBe(true)
  })

  // Renombrar un producto no puede chocar consigo mismo.
  it('el producto que se edita no cuenta como repetido', () => {
    expect(nombreRepetido('Azúcar en libra', productos, '1')).toBe(false)
    expect(nombreRepetido('Azúcar en libra', productos, '2')).toBe(true)
  })

  it('un nombre nuevo no está repetido', () => {
    expect(nombreRepetido('Frijoles', productos)).toBe(false)
    expect(nombreRepetido('   ', productos)).toBe(false)
  })
})

describe('cambiosDeProducto', () => {
  const original: ValoresProducto = {
    nombre: 'Azúcar en libra', precio: 15, stock_actual: 10, unidad: 'libra', categoria_id: null,
  }

  it('sin cambios devuelve un objeto vacío', () => {
    expect(cambiosDeProducto(original, { ...original })).toEqual({})
  })

  // Mandar el nombre sin haberlo tocado puede chocar contra el índice único
  // por una carrera, sin que nadie haya intentado renombrar nada.
  it('manda solo lo que se tocó', () => {
    expect(cambiosDeProducto(original, { ...original, precio: 18 })).toEqual({ precio: 18 })
  })

  it('quitar el precio es un cambio, no una ausencia', () => {
    expect(cambiosDeProducto(original, { ...original, precio: null })).toEqual({ precio: null })
  })

  it('poner la existencia en cero es un cambio', () => {
    expect(cambiosDeProducto(original, { ...original, stock_actual: 0 })).toEqual({ stock_actual: 0 })
  })

  it('reconoce varios cambios a la vez', () => {
    const cambios = cambiosDeProducto(original, {
      ...original, nombre: 'Azúcar', unidad: 'kilo', categoria_id: 'abc',
    })
    expect(cambios).toEqual({ nombre: 'Azúcar', unidad: 'kilo', categoria_id: 'abc' })
  })
})

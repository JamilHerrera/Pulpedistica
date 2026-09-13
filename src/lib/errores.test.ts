import { describe, it, expect } from 'vitest'
import {
  normalizarMensaje, limpiarSecretos, huellaDeError, codigoLegible,
  esRuido, describir, prepararTicket, TITULO_MAX,
} from './errores'

describe('limpiarSecretos', () => {
  it('borra el token de sesión que a veces viaja en el mensaje', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.dBjftJeZ4CVPmB92K27u'
    const limpio = limpiarSecretos(`falló con Authorization: Bearer ${jwt}`)
    expect(limpio).not.toContain(jwt)
    expect(limpio).not.toContain('eyJ')
  })

  it('borra la clave del proyecto', () => {
    const limpio = limpiarSecretos('apikey sb_publishable_fGrjeBZWfsm_hJR1pOQ inválida')
    expect(limpio).not.toContain('sb_publishable_fGrjeBZWfsm_hJR1pOQ')
  })

  it('borra los correos, que identifican a una persona', () => {
    expect(limpiarSecretos('no existe admin@jamilherreravargas.com'))
      .toBe('no existe {correo}')
  })

  it('deja intacto un mensaje que no tiene nada sensible', () => {
    const m = 'column ventas.total does not exist'
    expect(limpiarSecretos(m)).toBe(m)
  })
})

describe('normalizarMensaje', () => {
  it('borra los identificadores, que cambian en cada ocurrencia', () => {
    const a = normalizarMensaje('no se encontró el producto d1626dcc-cf7f-43c8-9311-40ae8091b2be')
    const b = normalizarMensaje('no se encontró el producto a1c89884-a143-44aa-9d62-9ab30d42b32a')
    expect(a).toBe(b)
  })

  it('borra las fechas', () => {
    const a = normalizarMensaje('la venta del 2026-09-12T18:40:00Z falló')
    const b = normalizarMensaje('la venta del 2025-01-03T04:02:11Z falló')
    expect(a).toBe(b)
  })

  it('unifica los espacios y recorta los extremos', () => {
    expect(normalizarMensaje('  error   raro \n  acá  ')).toBe('error raro acá')
  })

  // Esta es la razón de que la normalización NO toque los números sueltos.
  it('NO confunde dos códigos de error de Postgres distintos', () => {
    const permiso = normalizarMensaje('error 42501: permiso denegado')
    const duplicado = normalizarMensaje('error 23505: clave duplicada')
    expect(permiso).not.toBe(duplicado)
  })
})

describe('huellaDeError', () => {
  it('la misma falla da siempre la misma huella', () => {
    expect(huellaDeError('render', 'x is not a function'))
      .toBe(huellaDeError('render', 'x is not a function'))
  })

  it('dos fallas distintas dan huellas distintas', () => {
    expect(huellaDeError('render', 'x is not a function'))
      .not.toBe(huellaDeError('render', 'y is not a function'))
  })

  it('el mismo mensaje desde otro origen es otro problema', () => {
    expect(huellaDeError('render', 'algo falló'))
      .not.toBe(huellaDeError('promesa', 'algo falló'))
  })

  // Lo que hace que el contador de la base sirva: dos apariciones del mismo
  // bug con ids distintos tienen que caer en el MISMO ticket.
  it('agrupa dos apariciones que solo difieren en el identificador', () => {
    expect(huellaDeError('consola', 'fiado 11e8e71c-0000-4000-8000-000000000001 no existe'))
      .toBe(huellaDeError('consola', 'fiado 22f9f82d-0000-4000-8000-000000000002 no existe'))
  })

  it('agrupa el mismo fallo sufrido por dos usuarios distintos', () => {
    expect(huellaDeError('consola', 'no se pudo cargar el perfil de ana@pulperia.hn'))
      .toBe(huellaDeError('consola', 'no se pudo cargar el perfil de luis@pulperia.hn'))
  })

  it('siempre mide 16 caracteres hexadecimales', () => {
    for (const m of ['', 'a', 'algo mucho más largo que lo anterior con acentos ñá']) {
      expect(huellaDeError('manual', m)).toMatch(/^[0-9a-f]{16}$/)
    }
  })
})

describe('codigoLegible', () => {
  it('son seis caracteres en mayúscula, dictables por teléfono', () => {
    expect(codigoLegible('3f9a2bc10011ffee')).toBe('3F9A2B')
  })
})

describe('esRuido', () => {
  it.each([
    'ResizeObserver loop completed with undelivered notifications',
    'Error en chrome-extension://abcdef/inject.js',
    'TypeError: Failed to fetch',
    'Script error.',
  ])('descarta el ruido conocido: %s', (mensaje) => {
    expect(esRuido(mensaje)).toBe(true)
  })

  it.each([
    'Cannot read properties of undefined (reading nombre)',
    '42501: new row violates row-level security policy',
    'column ventas.total does not exist',
  ])('deja pasar un error real: %s', (mensaje) => {
    expect(esRuido(mensaje)).toBe(false)
  })
})

describe('describir', () => {
  it('usa el mensaje de un Error', () => {
    expect(describir(new Error('se rompió'))).toBe('se rompió')
  })

  it('pone el código adelante en un error de Supabase, que no es un Error', () => {
    expect(describir({ code: '42501', message: 'permiso denegado', details: null }))
      .toBe('42501: permiso denegado')
  })

  it('sobrevive a un objeto con referencias circulares', () => {
    const circular: Record<string, unknown> = {}
    circular.yo = circular
    expect(() => describir(circular)).not.toThrow()
  })

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [42, '42'],
  ])('convierte %s, que es lo que a veces llega por un catch', (valor, esperado) => {
    expect(describir(valor)).toBe(esperado)
  })
})

describe('prepararTicket', () => {
  it('arma el ticket con la traza en el detalle', () => {
    const ticket = prepararTicket(new Error('se rompió el semáforo'), 'render')
    expect(ticket).not.toBeNull()
    expect(ticket?.titulo).toBe('se rompió el semáforo')
    expect(ticket?.origen).toBe('render')
    expect(ticket?.detalle).toContain('Error')
  })

  it('antepone el contexto cuando se le pasa', () => {
    expect(prepararTicket(new Error('timeout'), 'consola', 'Error anulando venta')?.titulo)
      .toBe('Error anulando venta: timeout')
  })

  it('devuelve null si es ruido, para no ensuciar la bandeja', () => {
    expect(prepararTicket(new Error('ResizeObserver loop limit exceeded'), 'javascript'))
      .toBeNull()
  })

  it('devuelve null si no hay nada que reportar', () => {
    expect(prepararTicket('   ', 'javascript')).toBeNull()
  })

  it('recorta un título gigante en vez de mandarlo entero', () => {
    const ticket = prepararTicket('x'.repeat(1000), 'javascript')
    expect(ticket?.titulo.length).toBe(TITULO_MAX)
  })

  it('sanea el título antes de calcular la huella', () => {
    const ticket = prepararTicket('falló para admin@jamilherreravargas.com', 'consola')
    expect(ticket?.titulo).not.toContain('@jamilherreravargas.com')
  })

  it('un error sin traza deja el detalle vacío en vez de inventarlo', () => {
    expect(prepararTicket('falló algo raro', 'manual')?.detalle).toBeNull()
  })
})

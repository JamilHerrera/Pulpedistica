import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Esta es la red que impide cobrar dos veces. Si el usuario toca "Confirmar"
 * dos veces, o el navegador reintenta tras un corte, la base rechaza el
 * duplicado por el índice único y acá hay que recuperar la fila original en
 * vez de crear otra.
 */

const insertMock = vi.fn()
const selectEqSingle = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: (fila: unknown) => {
        insertMock(fila)
        return { select: () => ({ single: () => insertMock.resultado }) }
      },
      select: () => ({ eq: () => ({ single: () => selectEqSingle() }) }),
    }),
  },
}))

const { insertarIdempotente, nuevaClave } = await import('./idempotencia')

beforeEach(() => {
  insertMock.mockClear()
  selectEqSingle.mockReset()
})

describe('nuevaClave', () => {
  it('genera un identificador distinto en cada llamada', () => {
    expect(nuevaClave()).not.toBe(nuevaClave())
  })

  it('devuelve un UUID con el formato esperado', () => {
    expect(nuevaClave()).toMatch(/^[0-9a-f-]{36}$/i)
  })
})

describe('insertarIdempotente', () => {
  it('adjunta la clave a la fila que inserta', async () => {
    insertMock.resultado = Promise.resolve({ data: { id: 'v1' }, error: null })
    await insertarIdempotente('ventas', { monto_total: 50 }, 'clave-abc')
    expect(insertMock).toHaveBeenCalledWith({ monto_total: 50, idempotency_key: 'clave-abc' })
  })

  it('en el caso normal devuelve la fila creada', async () => {
    insertMock.resultado = Promise.resolve({ data: { id: 'v1' }, error: null })
    const r = await insertarIdempotente<{ id: string }>('ventas', {}, 'k')
    expect(r).toEqual({ fila: { id: 'v1' }, yaExistia: false })
  })

  it('ante una clave repetida no duplica: recupera la fila original', async () => {
    // 23505 = violación de restricción única. Es el segundo toque del usuario.
    insertMock.resultado = Promise.resolve({ data: null, error: { code: '23505' } })
    selectEqSingle.mockResolvedValue({ data: { id: 'la-de-antes' }, error: null })

    const r = await insertarIdempotente<{ id: string }>('ventas', {}, 'k')
    expect(r).toEqual({ fila: { id: 'la-de-antes' }, yaExistia: true })
  })

  it('propaga cualquier otro error en vez de tragárselo', async () => {
    // Un fallo real (permisos, red) no puede disfrazarse de éxito: si se
    // ocultara, la pantalla diría "venta registrada" sin haber registrado nada.
    insertMock.resultado = Promise.resolve({ data: null, error: { code: '42501', message: 'RLS' } })
    await expect(insertarIdempotente('ventas', {}, 'k')).rejects.toMatchObject({ code: '42501' })
  })

  it('falla si tampoco puede recuperar la fila duplicada', async () => {
    insertMock.resultado = Promise.resolve({ data: null, error: { code: '23505' } })
    selectEqSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    await expect(insertarIdempotente('ventas', {}, 'k')).rejects.toMatchObject({ code: 'PGRST116' })
  })
})

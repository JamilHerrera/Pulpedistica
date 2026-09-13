import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Pruebas de las defensas del capturador.
 *
 * No se prueba que el ticket llegue a Supabase —eso es la base, y probarlo acá
 * sería verificar un simulacro—. Se prueba lo que sí puede tumbar la app del
 * usuario si está mal: que un error en bucle no genere peticiones infinitas,
 * que reportar un error no pueda reportarse a sí mismo, y que un fallo sin
 * internet no se pierda.
 */

const rpc = vi.fn()
vi.mock('./supabase', () => ({ supabase: { rpc } }))

/** localStorage de mentira: en Node no existe. */
function almacenamientoFalso() {
  const datos = new Map<string, string>()
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v) },
    removeItem: (k: string) => { datos.delete(k) },
    clear: () => { datos.clear() },
    key: () => null,
    length: 0,
  } as Storage
}

const CLAVE_COLA = 'pa_tickets_pendientes'

let escuchas: Record<string, ((e: unknown) => void)[]>

/** Deja el módulo recién cargado, sin el estado de la prueba anterior. */
async function cargarModulo(online = true) {
  vi.resetModules()
  rpc.mockReset()
  rpc.mockResolvedValue({ data: 'id-falso', error: null })

  escuchas = {}
  const ventana = {
    addEventListener: (tipo: string, fn: (e: unknown) => void) => {
      escuchas[tipo] = [...(escuchas[tipo] ?? []), fn]
    },
    location: { pathname: '/admin', search: '?pantalla=fiados' },
  }

  vi.stubGlobal('window', ventana)
  vi.stubGlobal('navigator', { onLine: online, userAgent: 'Navegador de prueba' })
  vi.stubGlobal('localStorage', almacenamientoFalso())

  return await import('./tickets')
}

function colaGuardada(): { huella: string; titulo: string }[] {
  return JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]')
}

/** El envío es una promesa suelta: hay que dejar correr la microcola. */
const dejarCorrer = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('reportarError', () => {
  it('manda el ticket con la pantalla y la dirección donde ocurrió', async () => {
    const { reportarError, fijarPantallaActual } = await cargarModulo()
    fijarPantallaActual('fiados')

    reportarError(new Error('se rompió al cobrar'), 'render')
    await dejarCorrer()

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('reportar_error', expect.objectContaining({
      p_titulo: 'se rompió al cobrar',
      p_origen: 'render',
      p_pantalla: 'fiados',
      p_ruta: '/admin?pantalla=fiados',
      p_navegador: 'Navegador de prueba',
    }))
  })

  it('devuelve el código corto para que el usuario lo pueda dictar', async () => {
    const { reportarError } = await cargarModulo()
    expect(reportarError(new Error('algo'), 'render')).toMatch(/^[0-9A-F]{6}$/)
  })

  it('descarta el ruido del navegador sin llamar a la base', async () => {
    const { reportarError } = await cargarModulo()
    expect(reportarError(new Error('ResizeObserver loop limit exceeded'))).toBeNull()
    await dejarCorrer()
    expect(rpc).not.toHaveBeenCalled()
  })

  // El caso que motiva los topes: un bug dentro de un efecto de React se
  // dispara sin parar. Sin esto, la app se tumbaría sola a peticiones.
  it('un mismo error repetido cien veces se manda UNA sola vez', async () => {
    const { reportarError } = await cargarModulo()
    for (let i = 0; i < 100; i++) {
      reportarError(new Error('el mismo fallo de siempre'), 'consola')
      await dejarCorrer()
    }
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('corta a los 30 problemas distintos por sesión', async () => {
    const { reportarError } = await cargarModulo()
    for (let i = 0; i < 60; i++) {
      reportarError(new Error(`fallo distinto número ${i}`), 'consola')
      await dejarCorrer()
    }
    expect(rpc).toHaveBeenCalledTimes(30)
  })

  it('nunca lanza, por más raro que sea lo que le pasen', async () => {
    const { reportarError } = await cargarModulo()
    const circular: Record<string, unknown> = {}
    circular.yo = circular
    for (const valor of [null, undefined, 0, circular, Symbol('x')]) {
      expect(() => reportarError(valor)).not.toThrow()
    }
  })
})

describe('sin conexión', () => {
  it('guarda el error en vez de perderlo', async () => {
    const { reportarError } = await cargarModulo(false)
    reportarError(new Error('falló mientras no había señal'), 'promesa')
    await dejarCorrer()

    expect(rpc).not.toHaveBeenCalled()
    expect(colaGuardada()).toHaveLength(1)
    expect(colaGuardada()[0].titulo).toBe('falló mientras no había señal')
  })

  it('lo manda cuando vuelve el internet', async () => {
    const { reportarError, vaciarCola } = await cargarModulo(false)
    reportarError(new Error('falló sin señal'), 'promesa')
    await dejarCorrer()

    await vaciarCola()
    expect(rpc).toHaveBeenCalledOnce()
    expect(colaGuardada()).toHaveLength(0)
  })

  it('si el envío vuelve a fallar, el error se queda en la cola', async () => {
    const { reportarError, vaciarCola } = await cargarModulo(false)
    reportarError(new Error('falló sin señal'), 'promesa')
    await dejarCorrer()

    rpc.mockResolvedValue({ data: null, error: { message: 'sigue sin red' } })
    await vaciarCola()
    expect(colaGuardada()).toHaveLength(1)
  })

  it('la cola no se llena con el mismo error repetido', async () => {
    const { reportarError } = await cargarModulo(false)
    for (let i = 0; i < 10; i++) {
      // Se cambia el identificador, que la huella normaliza: para el sistema
      // sigue siendo el mismo problema.
      reportarError(new Error(`no existe el fiado ${i}1111111-2222-4333-8444-555555555555`), 'consola')
      await dejarCorrer()
    }
    expect(colaGuardada()).toHaveLength(1)
  })
})

describe('instalarCapturaDeErrores', () => {
  it('convierte en ticket un console.error que ya estaba escrito en la app', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    const original = console.error
    try {
      console.error = vi.fn()
      instalarCapturaDeErrores()

      console.error('Error registrando fiado:', new Error('permiso denegado'))
      await dejarCorrer()

      expect(rpc).toHaveBeenCalledWith('reportar_error', expect.objectContaining({
        p_origen: 'consola',
        p_titulo: 'permiso denegado',
      }))
    } finally {
      console.error = original
    }
  })

  it('deja que la consola siga mostrando lo mismo de antes', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    const original = console.error
    const espia = vi.fn()
    try {
      console.error = espia
      instalarCapturaDeErrores()
      console.error('sigo saliendo en la consola')
      expect(espia).toHaveBeenCalledWith('sigo saliendo en la consola')
    } finally {
      console.error = original
    }
  })

  // La recursión que este módulo tiene que hacer imposible: se parchea la
  // consola, el envío falla, el cliente de Supabase escribe en la consola, y
  // eso volvería a disparar un envío.
  it('un fallo al reportar no se reporta a sí mismo', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    const original = console.error
    try {
      console.error = vi.fn()
      instalarCapturaDeErrores()

      rpc.mockImplementation(async () => {
        console.error('el reporte también falló')
        return { data: null, error: { message: 'sin red' } }
      })

      console.error(new Error('el fallo original'))
      await dejarCorrer()
      await dejarCorrer()

      expect(rpc).toHaveBeenCalledOnce()
    } finally {
      console.error = original
    }
  })

  it('atrapa una promesa que nadie manejó', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    instalarCapturaDeErrores()

    escuchas.unhandledrejection[0]({ reason: new Error('la consulta se cayó') })
    await dejarCorrer()

    expect(rpc).toHaveBeenCalledWith('reportar_error', expect.objectContaining({
      p_origen: 'promesa',
      p_titulo: 'la consulta se cayó',
    }))
  })

  it('avisa cuando un archivo del despliegue no carga', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    instalarCapturaDeErrores()

    escuchas.error[0]({ target: { tagName: 'SCRIPT', src: 'https://ejemplo.hn/app.js' } })
    await dejarCorrer()

    expect(rpc).toHaveBeenCalledWith('reportar_error', expect.objectContaining({
      p_origen: 'recurso',
      p_titulo: 'No cargó script: https://ejemplo.hn/app.js',
    }))
  })

  it('instalarla dos veces no duplica los reportes', async () => {
    const { instalarCapturaDeErrores } = await cargarModulo()
    const original = console.error
    try {
      console.error = vi.fn()
      instalarCapturaDeErrores()
      instalarCapturaDeErrores()

      escuchas.unhandledrejection[0]({ reason: new Error('una sola vez') })
      await dejarCorrer()

      expect(rpc).toHaveBeenCalledOnce()
    } finally {
      console.error = original
    }
  })
})

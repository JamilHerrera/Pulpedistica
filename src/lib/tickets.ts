/**
 * Captura de errores: qué se hace con un fallo cuando ocurre.
 *
 * Antes de esto, cada error terminaba en `console.error` y ahí moría, dentro
 * del navegador de alguien que nunca va a abrir la consola. Este módulo pone
 * escuchas en los cuatro lugares por donde un error puede escaparse en una
 * aplicación web —el crash de React, la promesa sin `catch`, la excepción
 * suelta y el `console.error` que ya estaba escrito— y los deposita como
 * tickets en la base.
 *
 * El requisito que manda sobre todo el archivo: NADA DE ACÁ PUEDE ROMPER LA
 * APP. Un reportador de errores que falla es peor que no tenerlo, porque su
 * propio fallo se reporta y entra en bucle. Por eso todo va envuelto en
 * `try/catch` mudo, hay una bandera de reentrada y hay topes por sesión.
 */

import {
  prepararTicket, codigoLegible, describir,
  type OrigenError, type ErrorNormalizado,
} from './errores'

/** Máximo de reportes distintos que una sesión manda. Ver `dentroDelTope`. */
const TOPE_POR_SESION = 30
/** Ventana en la que una misma huella no se vuelve a mandar. */
const REPETIR_CADA_MS = 60_000
/** Dónde espera lo que no se pudo mandar por falta de conexión. */
const CLAVE_COLA = 'pa_tickets_pendientes'
/** Tope de la cola. Un dispositivo semanas sin internet no llena el disco. */
const COLA_MAX = 20

/**
 * Bandera de reentrada.
 *
 * Es la pieza más importante del archivo. Se parchea `console.error`, así que
 * si reportar un error produjera un `console.error` —y produce uno en cuanto
 * falla la red— la captura se llamaría a sí misma sin fin. Mientras esto está
 * en `true`, la captura no hace nada.
 */
let reportando = false

/**
 * Lo mismo, pero para el tramo asíncrono.
 *
 * `reportando` solo cubre la parte síncrona: se apaga en cuanto el envío sale
 * en camino. El bucle peligroso vive justo después, mientras se espera la
 * respuesta, porque el cliente de Supabase escribe en la consola cuando la
 * petición falla, y esa consola está parcheada. Mientras haya un envío en
 * vuelo no se acepta ningún reporte nuevo; se pierde algún error que ocurra
 * en esos milisegundos, a cambio de que sea imposible entrar en recursión.
 */
let enviosEnVuelo = 0

/** Huellas ya mandadas en esta sesión, con cuándo, para no repetir. */
const yaReportado = new Map<string, number>()

/**
 * Pantalla en la que está parado el usuario. La escribe el panel al navegar.
 * Es un módulo suelto y no un contexto de React porque los errores que hay
 * que capturar son justamente los que ocurren cuando React ya no funciona.
 */
let pantallaActual: string | null = null

export function fijarPantallaActual(pantalla: string | null) {
  pantallaActual = pantalla
}

/** Último código mostrado, para que la app se lo pueda enseñar al usuario. */
let ultimoCodigo: string | null = null

export function ultimoCodigoDeError(): string | null {
  return ultimoCodigo
}

// ── Cola para cuando no hay internet ───────────────────────────────────────
//
//  La app se usa en pulperías donde el internet se cae seguido, y un error
//  que ocurre justo sin señal es tan real como cualquier otro. Se guarda en
//  `localStorage` —no en memoria— porque el caso típico es que el usuario
//  cierre la pestaña frustrado y la vuelva a abrir después.

interface Pendiente extends ErrorNormalizado {
  pantalla: string | null
  ruta: string
  navegador: string
}

function leerCola(): Pendiente[] {
  try {
    const crudo = localStorage.getItem(CLAVE_COLA)
    const datos: unknown = crudo ? JSON.parse(crudo) : []
    return Array.isArray(datos) ? (datos as Pendiente[]) : []
  } catch {
    // Almacenamiento bloqueado o contenido corrupto: se sigue sin cola.
    return []
  }
}

function guardarCola(cola: Pendiente[]) {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola.slice(-COLA_MAX)))
  } catch {
    // Modo privado o cuota llena. Perder un reporte no justifica un fallo.
  }
}

function encolar(t: Pendiente) {
  const cola = leerCola()
  // La cola también deduplica: sin conexión, un bucle podría llenarla con la
  // misma falla y desplazar reportes distintos, que son los que interesan.
  if (cola.some((p) => p.huella === t.huella)) return
  guardarCola([...cola, t])
}

/** Manda lo que quedó pendiente. Se llama al arrancar y al volver la señal. */
export async function vaciarCola(): Promise<void> {
  const cola = leerCola()
  if (cola.length === 0) return

  // Se vacía antes de intentar: si el envío vuelve a fallar, `enviar` los
  // reencola. Al revés se correría el riesgo de mandarlos dos veces, aunque
  // la huella lo haría inofensivo.
  guardarCola([])
  for (const pendiente of cola) {
    await enviar(pendiente)
  }
}

// ── Envío ──────────────────────────────────────────────────────────────────

async function enviar(t: Pendiente): Promise<void> {
  enviosEnVuelo++
  try {
    // Se carga acá y no arriba a propósito. `supabase.ts` lanza al importarse
    // si faltan las variables de entorno, y este módulo se instala en el
    // primer renglón del arranque: importarlo estático haría que una mala
    // configuración dejara la pantalla en blanco en vez de mostrar el aviso.
    // Como beneficio, el cliente de Supabase no entra al bundle inicial de
    // quien nunca tiene un error.
    const { supabase } = await import('./supabase')

    const { error } = await supabase.rpc('reportar_error', {
      p_huella: t.huella,
      p_titulo: t.titulo,
      p_origen: t.origen,
      p_detalle: t.detalle,
      p_pantalla: t.pantalla,
      p_ruta: t.ruta,
      p_navegador: t.navegador,
    })
    // Un error acá casi siempre es de red. Se guarda para el próximo intento
    // en vez de perderlo, y no se vuelve a reportar: sería recursión.
    if (error) encolar(t)
  } catch {
    encolar(t)
  } finally {
    enviosEnVuelo--
  }
}

/**
 * Topes de volumen.
 *
 * Un bug dentro de un `useEffect` puede dispararse cientos de veces por
 * segundo. La base ya deduplica por huella, pero mandarle cientos de
 * peticiones igual tumbaría la app del usuario. Estos dos límites son la
 * defensa del lado del cliente:
 *
 *   · una misma huella viaja como mucho una vez por minuto;
 *   · una sesión no abre más de `TOPE_POR_SESION` problemas distintos.
 *
 * Perder ocurrencias no importa: lo que hace falta saber es QUE pasa, y el
 * contador del servidor ya lo cuenta.
 */
function dentroDelTope(huella: string): boolean {
  const ahora = Date.now()
  const visto = yaReportado.get(huella)
  if (visto !== undefined && ahora - visto < REPETIR_CADA_MS) return false
  if (visto === undefined && yaReportado.size >= TOPE_POR_SESION) return false

  yaReportado.set(huella, ahora)
  return true
}

/**
 * Reporta un error y devuelve el código corto para mostrárselo al usuario, o
 * `null` si el reporte se descartó.
 *
 * Es deliberadamente síncrona en apariencia: el envío queda suelto porque
 * ningún punto de la app debería tener que esperar a que se cree un ticket
 * para seguir andando.
 */
export function reportarError(
  valor: unknown,
  origen: OrigenError = 'javascript',
  contexto?: string,
): string | null {
  if (reportando || enviosEnVuelo > 0) return null

  try {
    reportando = true

    const ticket = prepararTicket(valor, origen, contexto)
    if (!ticket || !dentroDelTope(ticket.huella)) return null

    const pendiente: Pendiente = {
      ...ticket,
      pantalla: pantallaActual,
      // Sin el hash de la URL: ahí es donde Supabase deja los tokens de
      // recuperación de contraseña cuando el usuario llega desde un correo.
      ruta: `${window.location.pathname}${window.location.search}`,
      navegador: navigator.userAgent,
    }

    ultimoCodigo = codigoLegible(ticket.huella)

    if (navigator.onLine === false) encolar(pendiente)
    else void enviar(pendiente)

    return ultimoCodigo
  } catch {
    // Ni siquiera preparar el ticket puede tumbar a quien nos llamó.
    return null
  } finally {
    reportando = false
  }
}

// ── Las cuatro puertas por donde se escapa un error ────────────────────────

let instalado = false

/**
 * Engancha la captura global. Se llama una vez, lo antes posible en el
 * arranque: un error que ocurra antes de esto no deja ticket.
 */
export function instalarCapturaDeErrores() {
  if (instalado) return
  instalado = true

  // 1. Excepciones sueltas y, con `capture`, los recursos que no cargan.
  window.addEventListener(
    'error',
    (evento: ErrorEvent) => {
      const destino = evento.target
      // Un <img> o un <script> que no carga dispara este mismo evento, pero
      // sin `error`: se distingue porque el objetivo es un elemento y no la
      // ventana. Vale la pena: así se detecta un despliegue con archivos
      // faltantes, que por fuera se ve como una pantalla en blanco.
      if (destino && destino !== window && (destino as HTMLElement).tagName) {
        const el = destino as HTMLElement & { src?: string; href?: string }
        const url = el.src ?? el.href ?? '(desconocida)'
        reportarError(`No cargó ${el.tagName.toLowerCase()}: ${url}`, 'recurso')
        return
      }
      reportarError(evento.error ?? evento.message, 'javascript')
    },
    true,
  )

  // 2. Promesas rechazadas que nadie atrapó. En una app que habla con una API
  //    en cada pantalla, esta es la fuente más común de fallos invisibles.
  window.addEventListener('unhandledrejection', (evento: PromiseRejectionEvent) => {
    reportarError(evento.reason, 'promesa')
  })

  // 3. Todo lo que la app ya escribía en la consola.
  //
  //    El código tiene decenas de `catch (e) { console.error(e) }` escritos
  //    mucho antes que esto. Interceptar la consola los convierte a todos en
  //    tickets sin tocar un solo `catch`, y sin que el próximo que alguien
  //    escriba quede fuera por olvido. Se conserva el comportamiento
  //    original: la consola sigue mostrando exactamente lo mismo.
  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    originalError(...args)
    // El primer argumento que sea un Error de verdad manda, porque trae la
    // traza; si no hay ninguno, se arma el mensaje con todo lo que llegó.
    const conTraza = args.find((a) => a instanceof Error)
    reportarError(conTraza ?? args.map(describir).join(' '), 'consola')
  }

  // 4. Lo que quedó en la cola de una sesión sin internet.
  window.addEventListener('online', () => { void vaciarCola() })
  void vaciarCola()
}

/**
 * Cómo se convierte un error suelto en un ticket.
 *
 * Todo lo de este archivo es cálculo puro: no toca la red, ni el DOM, ni el
 * reloj. Esa separación es a propósito. La parte que sí tiene efectos vive en
 * `tickets.ts`, y es la difícil de probar; acá quedan las decisiones que sí se
 * pueden verificar una por una, que son justamente las que rompen el sistema
 * si están mal: qué se considera el mismo problema y qué texto se manda.
 */

/** De dónde salió el error. Coincide con el CHECK de la migración 013. */
export type OrigenError = 'render' | 'promesa' | 'javascript' | 'consola' | 'recurso' | 'manual'

export interface ErrorNormalizado {
  huella: string
  titulo: string
  origen: OrigenError
  detalle: string | null
}

/** Tope del título. La base recorta igual; acá se evita mandar de más. */
export const TITULO_MAX = 300
/** Tope de la traza. Más que esto no ayuda a depurar y sí infla la tabla. */
export const DETALLE_MAX = 4000

// ── Saneado ────────────────────────────────────────────────────────────────

/**
 * Cosas que NUNCA pueden viajar en un ticket.
 *
 * Un mensaje de error arrastra lo que había en la petición que falló, y ahí
 * puede venir el token de sesión de quien lo sufrió. Un ticket lo lee soporte:
 * mandar un JWT sería regalar la sesión de un cliente. Se redacta antes de
 * calcular la huella, así que dos usuarios distintos con el mismo fallo caen
 * igual en el mismo ticket.
 */
const SECRETOS: [RegExp, string][] = [
  // JWT de Supabase (el access_token de la sesión).
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '{token}'],
  // Claves de proyecto, publicables o secretas.
  [/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '{clave}'],
  [/\b(apikey|api_key|access_token|refresh_token|password|contrasena)["'\s:=]+[^\s,;&"'}]+/gi, '$1={oculto}'],
  [/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer {oculto}'],
  // Correos: identifican a una persona y no aportan a la causa del fallo.
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '{correo}'],
]

/** Quita de un texto todo lo que no debería salir del navegador. */
export function limpiarSecretos(texto: string): string {
  return SECRETOS.reduce((t, [patron, reemplazo]) => t.replace(patron, reemplazo), texto)
}

// ── Identidad del problema ─────────────────────────────────────────────────

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
const FECHA_ISO = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b/g
const HEX_LARGO = /\b[0-9a-f]{16,}\b/gi
const QUERY_STRING = /\?[^\s)"']+/g

/**
 * Deja el mensaje en su forma estable: la parte que se repite entre dos
 * apariciones del mismo bug.
 *
 * Se borran identificadores y fechas, que cambian en cada ocurrencia y
 * partirían un solo problema en cientos de tickets.
 *
 * Los NÚMEROS SUELTOS SE CONSERVAN a propósito, aunque tiente quitarlos:
 * los códigos de error de Postgres son números («42501» es permiso denegado y
 * «23505» es clave duplicada). Colapsarlos fundiría dos fallas sin relación en
 * un mismo ticket, que es mucho peor que abrir un ticket de más.
 */
export function normalizarMensaje(mensaje: string): string {
  return limpiarSecretos(mensaje)
    .replace(UUID, '{id}')
    .replace(FECHA_ISO, '{fecha}')
    .replace(HEX_LARGO, '{hex}')
    .replace(QUERY_STRING, '?{params}')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hash FNV-1a de 32 bits, corrido dos veces con semillas distintas para armar
 * 16 caracteres. No es criptográfico y no necesita serlo: solo tiene que dar
 * siempre lo mismo para la misma entrada, y ser lo bastante ancho para que dos
 * errores distintos no compartan fila. Se usa este y no `crypto.subtle` porque
 * aquello es asíncrono, y esto corre dentro de manejadores de error donde una
 * promesa más es una fuente más de fallos.
 */
function fnv1a(texto: string, semilla: number): string {
  let h = semilla
  for (const caracter of texto) {
    h ^= caracter.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Identidad del problema.
 *
 * Se calcula sobre el origen y el mensaje normalizado, y DELIBERADAMENTE NO
 * sobre la traza. Los nombres de archivo del build llevan un hash que cambia
 * en cada despliegue, así que incluir el stack abriría tickets nuevos para el
 * mismo bug cada vez que se publica una versión, y el contador —que es lo que
 * dice qué arreglar primero— nunca crecería.
 */
export function huellaDeError(origen: OrigenError, mensaje: string): string {
  const base = `${origen}|${normalizarMensaje(mensaje)}`
  return fnv1a(base, 0x811c9dc5) + fnv1a(base, 0x9e3779b1)
}

/**
 * Código corto que se le muestra al usuario cuando algo revienta, para que
 * pueda decir «me salió el error 3F9A2B» y soporte encuentre el ticket sin
 * pedirle que explique qué estaba haciendo.
 */
export function codigoLegible(huella: string): string {
  return huella.slice(0, 6).toUpperCase()
}

// ── Qué vale la pena reportar ──────────────────────────────────────────────

/**
 * Ruido conocido del navegador: cosas que aparecen en la consola de cualquier
 * página y no son fallas de la app.
 *
 * Sin este filtro la bandeja se llena de tickets de extensiones del usuario y
 * de avisos benignos, y los errores reales quedan enterrados. Vale más dejar
 * pasar un fallo raro que volver la bandeja inútil.
 */
const RUIDO = [
  // Aviso benigno del navegador, no rompe nada. Es el ruido más común.
  'resizeobserver loop',
  // Extensiones del usuario, no código nuestro.
  'chrome-extension://',
  'moz-extension://',
  'safari-extension://',
  // El usuario cambió de pantalla y el navegador canceló la petición.
  'aborterror',
  'the operation was aborted',
  // Falla de red pura: no hay bug que arreglar, no hay internet.
  'failed to fetch',
  'networkerror when attempting to fetch',
  'load failed',
  // El propio aviso de React cuando una barrera atrapa un error. La barrera
  // ya abrió el ticket bueno, con el árbol de componentes; esto solo lo
  // duplicaría. Ocurre también en producción, no solo en desarrollo.
  'the above error occurred in the',
  // Guiones de terceros que el navegador no deja inspeccionar.
  'script error',
  'non-error promise rejection captured with value: undefined',
]

export function esRuido(mensaje: string): boolean {
  const m = mensaje.toLowerCase()
  return RUIDO.some((patron) => m.includes(patron))
}

// ── Armado del ticket ──────────────────────────────────────────────────────

/** Texto legible de cualquier cosa que llegue por un `catch`. */
export function describir(valor: unknown): string {
  if (typeof valor === 'string') return valor
  if (valor instanceof Error) return valor.message || valor.name
  if (valor && typeof valor === 'object') {
    // Los errores de Supabase no son Error: son objetos con `message` y
    // `code`. El código es lo que identifica la falla, así que va al frente.
    const o = valor as Record<string, unknown>
    const partes = [o.code, o.message ?? o.error_description ?? o.error, o.details]
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    if (partes.length > 0) return partes.join(': ')
    try {
      return JSON.stringify(valor)
    } catch {
      // Referencias circulares: no hay nada mejor que el tipo.
      return Object.prototype.toString.call(valor)
    }
  }
  return String(valor)
}

function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`
}

/**
 * Convierte cualquier cosa capturada en el ticket que se va a mandar, o en
 * `null` si no vale la pena reportarla.
 */
export function prepararTicket(
  valor: unknown,
  origen: OrigenError,
  contexto?: string,
): ErrorNormalizado | null {
  const crudo = describir(valor).trim()
  if (crudo.length === 0 || esRuido(crudo)) return null

  const titulo = recortar(limpiarSecretos(contexto ? `${contexto}: ${crudo}` : crudo), TITULO_MAX)

  const stack = valor instanceof Error && valor.stack ? valor.stack : null
  const detalle = stack ? recortar(limpiarSecretos(stack), DETALLE_MAX) : null

  return {
    huella: huellaDeError(origen, titulo),
    titulo,
    origen,
    detalle,
  }
}

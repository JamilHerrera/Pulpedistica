/**
 * Caché en memoria para las consultas a Supabase.
 *
 * Resuelve dos problemas concretos del panel:
 *
 * 1. Cambiar de pestaña y volver rehacía todas las consultas. Ahora, dentro
 *    de la ventana de validez, se reusa lo ya traído y el cambio es
 *    instantáneo.
 * 2. Consultas duplicadas en paralelo. React monta los efectos dos veces en
 *    desarrollo (StrictMode) y varias pantallas piden lo mismo a la vez; sin
 *    esto se disparaban peticiones idénticas simultáneas.
 *
 * Vive en memoria a propósito: al recargar la página se parte de cero. Son
 * ventas, stock y deudas, y guardarlos en disco arriesgaría mostrar cifras
 * viejas después de cerrar y abrir la app.
 */

interface Entrada {
  valor: unknown
  expira: number
}

const entradas = new Map<string, Entrada>()
const enVuelo = new Map<string, Promise<unknown>>()

/** Ventanas de validez según qué tan seguido cambia cada cosa. */
export const TTL = {
  /** Datos de operación: ventas, stock, deudas. */
  corto: 15_000,
  /** Agregados y análisis, que toleran unos segundos de retraso. */
  medio: 60_000,
  /** Catálogo casi estático, como las categorías. */
  largo: 5 * 60_000,
} as const

/**
 * Devuelve el valor cacheado si sigue vigente; si no, ejecuta la consulta.
 * Las llamadas simultáneas con la misma clave comparten una sola petición.
 */
export async function consultaCacheada<T>(
  clave: string,
  consulta: () => Promise<T>,
  ttl: number = TTL.corto,
): Promise<T> {
  const vigente = entradas.get(clave)
  if (vigente && vigente.expira > Date.now()) {
    return vigente.valor as T
  }

  const yaPedida = enVuelo.get(clave)
  if (yaPedida) return yaPedida as Promise<T>

  const promesa = consulta()
    .then((valor) => {
      // Solo se cachea lo que salió bien: un error debe reintentarse.
      entradas.set(clave, { valor, expira: Date.now() + ttl })
      return valor
    })
    .finally(() => {
      enVuelo.delete(clave)
    })

  enVuelo.set(clave, promesa)
  return promesa
}

/**
 * Descarta lo cacheado bajo un prefijo. Hay que llamarla después de cada
 * escritura y ante cada evento de realtime, o la pantalla seguiría mostrando
 * el estado anterior.
 */
export function invalidar(...prefijos: string[]) {
  for (const clave of [...entradas.keys()]) {
    if (prefijos.some((p) => clave.startsWith(p))) entradas.delete(clave)
  }
}

/** Borra todo. Se usa al cerrar sesión, para no filtrar datos entre cuentas. */
export function limpiarCache() {
  entradas.clear()
  enVuelo.clear()
}

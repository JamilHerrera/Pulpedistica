/**
 * Qué se puede escribir en la ficha de un producto.
 *
 * Son los datos del catálogo: cómo se llama el producto, cuánto cuesta, de qué
 * categoría es y cómo se vende. La existencia no está acá a propósito: es el
 * número que cambia todos los días cuando entra o sale mercadería, y se ajusta
 * en la tarjeta misma, sin abrir ninguna ficha.
 *
 * Las mismas reglas están en la base como restricciones —precio no negativo,
 * unidad de una lista cerrada, nombre único dentro del negocio— y ahí es donde
 * se garantizan. Esto no las reemplaza: evita el viaje de ida y vuelta y, sobre
 * todo, dice QUÉ campo está mal, que es algo que un error de Postgres no
 * comunica bien a quien está cargando mercadería.
 *
 * Todo es cálculo puro: ni red, ni DOM, ni reloj.
 */

import type { UnidadMedida } from './unidades'

/** Lo que el formulario tiene escrito: texto, tal como se tecleó. */
export interface CamposProducto {
  nombre: string
  /** Vacío significa "sin precio", que es un estado válido del catálogo. */
  precio: string
  unidad: UnidadMedida
  categoria_id: string | null
}

/** Lo que se manda a la base, ya convertido. */
export interface ValoresProducto {
  nombre: string
  precio: number | null
  unidad: UnidadMedida
  categoria_id: string | null
}

export type ErroresProducto = Partial<Record<'nombre' | 'precio', string>>

export type ResultadoValidacion =
  | { ok: true; valores: ValoresProducto }
  | { ok: false; errores: ErroresProducto }

/**
 * Los errores de un resultado, o un objeto vacío si la validación pasó.
 *
 * La comparación explícita con `false` no es adorno. El proyecto compila sin
 * `strictNullChecks`, y en ese modo TypeScript no estrecha la rama falsa de una
 * unión discriminada por un booleano: escrito como `r.ok ? {} : r.errores` no
 * compila, porque ahí `r` sigue siendo la unión entera.
 */
export function erroresDe(r: ResultadoValidacion): ErroresProducto {
  return r.ok === false ? r.errores : {}
}

/** Tope del nombre. No lo impone la base: es para que entre en una tarjeta. */
export const NOMBRE_MAX = 80

/** Tope del precio. Un número más grande que esto es un dedazo, no un precio. */
export const PRECIO_MAX = 999_999

/**
 * Normaliza un nombre para compararlo.
 *
 * Igual que el índice único de la base, que es `lower(trim(nombre))`: así
 * "Azúcar" y " azúcar " se detectan como el mismo producto ANTES de que la
 * base rechace el insert, y el mensaje puede decir cuál es el repetido.
 */
export function claveDeNombre(nombre: string): string {
  return nombre.trim().toLowerCase()
}

/** Interpreta un precio escrito a mano. Vacío es `null`, no cero. */
export function interpretarPrecio(texto: string): number | null | 'invalido' {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null

  const valor = Number.parseFloat(limpio)
  if (!Number.isFinite(valor) || valor < 0 || valor > PRECIO_MAX) return 'invalido'

  // Dos decimales: es lo que existe en la caja y lo que acepta numeric(10,2).
  return Math.round(valor * 100) / 100
}

export function validarProducto(campos: CamposProducto): ResultadoValidacion {
  const errores: ErroresProducto = {}

  const nombre = campos.nombre.trim()
  if (nombre === '') errores.nombre = 'Escribí el nombre del producto.'
  else if (nombre.length > NOMBRE_MAX) errores.nombre = `El nombre no puede pasar de ${NOMBRE_MAX} caracteres.`

  const precio = interpretarPrecio(campos.precio)
  if (precio === 'invalido') errores.precio = 'El precio tiene que ser un número de 0 en adelante.'

  if (Object.keys(errores).length > 0) return { ok: false, errores }

  return {
    ok: true,
    valores: {
      nombre,
      precio: precio as number | null,
      unidad: campos.unidad,
      // Cadena vacía en un <select> significa "sin categoría", y la columna
      // acepta NULL. Mandar '' rompería la llave foránea.
      categoria_id: campos.categoria_id || null,
    },
  }
}

/**
 * ¿Ya hay otro producto con ese nombre?
 *
 * El índice único de la base es la garantía; esto es para avisar mientras se
 * escribe, y para nombrar al culpable. Se excluye el producto que se está
 * editando: renombrar "Azucar" a "Azúcar" no choca consigo mismo.
 */
export function nombreRepetido(
  nombre: string,
  productos: { id: string; nombre: string }[],
  idQueSeEdita?: string,
): boolean {
  const clave = claveDeNombre(nombre)
  if (clave === '') return false
  return productos.some((p) => p.id !== idQueSeEdita && claveDeNombre(p.nombre) === clave)
}

/**
 * Qué cambió realmente entre la ficha guardada y lo que se escribió.
 *
 * Mandar solo los campos tocados evita dos cosas: reescribir columnas que
 * nadie editó —y que por tanto no deberían aparecer como cambio en la base— y
 * chocar contra el índice único de nombre cuando el nombre ni se tocó.
 * Devuelve un objeto vacío si no hay nada que guardar.
 */
export function cambiosDeProducto(
  original: ValoresProducto,
  nuevos: ValoresProducto,
): Partial<ValoresProducto> {
  const cambios: Partial<ValoresProducto> = {}
  if (nuevos.nombre !== original.nombre) cambios.nombre = nuevos.nombre
  if (nuevos.precio !== original.precio) cambios.precio = nuevos.precio
  if (nuevos.unidad !== original.unidad) cambios.unidad = nuevos.unidad
  if (nuevos.categoria_id !== original.categoria_id) cambios.categoria_id = nuevos.categoria_id
  return cambios
}

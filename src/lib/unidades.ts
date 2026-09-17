/**
 * Cómo se cuenta cada producto.
 *
 * Una pulpería vende dos cosas distintas con la misma pantalla: cosas que se
 * cuentan de a una —un cartón de huevos, una bolsa de sal— y cosas que se
 * pesan, donde media libra es una venta tan normal como cualquiera. Antes todo
 * era entero, así que media libra de queso había que cobrarla como una y el
 * stock quedaba mintiendo.
 *
 * Todo lo de este archivo es cálculo puro. Las mismas reglas están en la base
 * (migración 014): `registrar_venta` rechaza una cantidad partida de algo que
 * se vende por unidad. Acá se repiten para no hacer el viaje de ida y vuelta y
 * para poder deshabilitar lo que no corresponde, pero la base es la que manda.
 */

export type UnidadMedida = 'unidad' | 'libra' | 'kilo'

interface ReglaDeUnidad {
  /** Cómo se llama al elegirla en Inventario. */
  etiqueta: string
  /** Lo que se muestra junto a la cantidad. Vacío para las que se cuentan. */
  abreviatura: string
  /** ¿Admite media, un cuarto, tres cuartos? */
  fraccionable: boolean
  /** Cuánto suma o resta cada toque en los botones del carrito. */
  paso: number
}

export const UNIDADES: Record<UnidadMedida, ReglaDeUnidad> = {
  // La abreviatura va vacía a propósito: "3 huevos" se lee mejor que "3 un".
  unidad: { etiqueta: 'Por unidad', abreviatura: '',   fraccionable: false, paso: 1 },
  // Un cuarto de libra es el escalón más chico que se pide en el mostrador.
  libra:  { etiqueta: 'Por libra',  abreviatura: 'lb', fraccionable: true,  paso: 0.25 },
  kilo:   { etiqueta: 'Por kilo',   abreviatura: 'kg', fraccionable: true,  paso: 0.25 },
}

export const UNIDADES_DISPONIBLES = Object.keys(UNIDADES) as UnidadMedida[]

/** Tope de seguridad. Más que esto en una venta es un dedazo, no una compra. */
export const CANTIDAD_MAX = 9999

/**
 * Decimales que se guardan. Coincide con `numeric(10,3)` de la base: el caso
 * más fino que aparece es el octavo de libra (0.125).
 */
const DECIMALES = 3

/**
 * Una unidad desconocida se trata como contable.
 *
 * Puede llegar una si la base gana un valor nuevo antes que la app, o si una
 * fila vieja quedó con el campo vacío. Ante la duda conviene el comportamiento
 * más restrictivo: no admitir decimales donde quizá no correspondan.
 */
export function reglaDe(unidad: UnidadMedida | null | undefined): ReglaDeUnidad {
  return UNIDADES[unidad as UnidadMedida] ?? UNIDADES.unidad
}

export function esFraccionable(unidad: UnidadMedida | null | undefined): boolean {
  return reglaDe(unidad).fraccionable
}

/**
 * Deja la cantidad en una forma que la base acepte.
 *
 * El redondeo se hace multiplicando y dividiendo en vez de con `toFixed`
 * porque esto alimenta una multiplicación por precio: 0.1 + 0.2 no da 0.3 en
 * binario, y un centavo de más en el vuelto es un problema real, no teórico.
 */
export function redondearCantidad(
  cantidad: number,
  unidad: UnidadMedida | null | undefined,
): number {
  if (!Number.isFinite(cantidad)) return 0
  if (!esFraccionable(unidad)) return Math.trunc(cantidad)

  const factor = 10 ** DECIMALES
  return Math.round(cantidad * factor) / factor
}

/** ¿Esta cantidad se puede cobrar de este producto? */
export function cantidadValida(
  cantidad: number,
  unidad: UnidadMedida | null | undefined,
): boolean {
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > CANTIDAD_MAX) return false
  if (!esFraccionable(unidad) && !Number.isInteger(cantidad)) return false
  return true
}

/**
 * Suma o resta un escalón. Para lo que se cuenta es de a uno; para lo que se
 * pesa, de a cuarto de libra, que es como lo pide la gente.
 *
 * Nunca devuelve menos de cero: quitar por debajo de cero no significa nada, y
 * quien llama decide si un cero saca el producto del carrito.
 */
export function sumarPaso(
  cantidad: number,
  unidad: UnidadMedida | null | undefined,
  pasos: number,
): number {
  const siguiente = cantidad + reglaDe(unidad).paso * pasos
  return Math.max(0, redondearCantidad(siguiente, unidad))
}

/**
 * Cómo se escribe una cantidad en pantalla.
 *
 * Sin ceros de relleno: "2.5 lb" y no "2.500 lb", y "3" y no "3.00". Un número
 * con decimales que no hacen falta se lee como si fuera una cifra técnica, y
 * esto lo mira alguien despachando con la fila esperando.
 */
export function formatearCantidad(
  cantidad: number,
  unidad: UnidadMedida | null | undefined,
): string {
  if (!Number.isFinite(cantidad)) return '0'

  // OJO: acá NO se llama a `redondearCantidad`. Aquella trunca los decimales
  // de lo que se cuenta, y eso es una regla de ENTRADA: impide teclear medio
  // cartón de huevos. Aplicarla al mostrar sería mentir sobre un dato que ya
  // existe —una consulta que no traiga la columna `unidad` haría aparecer un
  // stock de 2.5 como 2— y una pantalla nunca debe esconder lo que hay.
  const { abreviatura } = reglaDe(unidad)
  // `parseFloat` de la cadena recortada saca los ceros sobrantes del final.
  const numero = String(Number.parseFloat(cantidad.toFixed(DECIMALES)))
  return abreviatura ? `${numero} ${abreviatura}` : numero
}

/**
 * Lo que cuesta esa cantidad de ese producto.
 *
 * Se redondea a dos decimales acá y no al mostrarlo, porque este número se
 * suma con otros para armar el total: si cada línea arrastra su resto binario,
 * el total termina descuadrado contra lo que el cliente ve sumando a mano.
 */
export function subtotalDeLinea(cantidad: number, precioUnitario: number): number {
  if (!Number.isFinite(cantidad) || !Number.isFinite(precioUnitario)) return 0
  return Math.round(cantidad * precioUnitario * 100) / 100
}

/** El total de la venta, sumando líneas ya redondeadas. */
export function totalDeVenta(
  lineas: { cantidad: number; precio_unitario: number }[],
): number {
  const suma = lineas.reduce((s, l) => s + subtotalDeLinea(l.cantidad, l.precio_unitario), 0)
  return Math.round(suma * 100) / 100
}

/**
 * Interpreta lo que alguien tecleó en el campo de cantidad.
 *
 * Acepta la coma como separador decimal: en Honduras se escribe tanto "0,5"
 * como "0.5", y rechazar una de las dos formas es hacerle perder el tiempo a
 * quien está cobrando. Devuelve `null` si no hay un número utilizable.
 */
export function interpretarCantidad(
  texto: string,
  unidad: UnidadMedida | null | undefined,
): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null

  const valor = Number.parseFloat(limpio)
  if (!Number.isFinite(valor)) return null

  const redondeado = redondearCantidad(valor, unidad)
  return cantidadValida(redondeado, unidad) ? redondeado : null
}

// ── Cuánto se puede llegar a vender ────────────────────────────────────────

/**
 * Recorta una cantidad a lo que realmente hay en existencia.
 *
 * La base rechaza la venta que supera el stock (migración 015), así que esto
 * no es la validación: es para que la pantalla no deje armar un carrito que
 * va a ser rechazado al cobrar. Descubrirlo recién al apretar "Cobrar", con
 * el cliente enfrente, es la peor forma de enterarse.
 *
 * Un stock que no se conoce —una consulta que no trajo la columna— no limita
 * nada: es preferible dejar pasar y que la base decida, antes que bloquear una
 * venta por un dato faltante.
 */
export function limitarAlStock(
  cantidad: number,
  stock: number | null | undefined,
  unidad: UnidadMedida | null | undefined,
): number {
  const pedida = redondearCantidad(cantidad, unidad)
  if (stock === null || stock === undefined || !Number.isFinite(stock)) return pedida
  if (stock <= 0) return 0
  return Math.min(pedida, redondearCantidad(stock, unidad))
}

/** ¿Queda algo de este producto? */
export function hayExistencias(stock: number | null | undefined): boolean {
  return Number.isFinite(stock) && (stock as number) > 0
}

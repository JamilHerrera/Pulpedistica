/**
 * Días de cobertura: para cuánto te alcanza lo que tenés.
 *
 * El semáforo de rotación (`semaforo.ts`) clasifica por UNIDADES VENDIDAS y
 * no mira el stock. Eso tiene un punto ciego que se vio con datos reales: un
 * producto agotado que la gente pide, y otro con existencias para ocho años,
 * salían los dos en "baja rotación". El mismo color para "reponé ya" y para
 * "tenés plata parada en la bodega".
 *
 * La cobertura cruza las dos cosas: stock ÷ lo que se vende por día. Y tiene
 * dos ventajas que no se buscaron pero salen solas:
 *
 *   · Los días no tienen unidad. 20 huevos y 20 libras de arroz no son la
 *     misma rotación, pero "te alcanza para 12 días" significa lo mismo en
 *     los dos casos. El problema de libras contra unidades desaparece.
 *   · No depende del tamaño del negocio. Un umbral fijo de "20 al mes para ser
 *     alta rotación" deja todo en rojo en una pulpería chica y todo en verde
 *     en un súper. Una semana de cobertura es una semana en cualquier lado.
 *
 * Todo es cálculo puro, para poder probarlo sin la base ni React.
 */

export type EstadoCobertura = 'urgente' | 'pronto' | 'sano' | 'exceso' | 'quieto'

/** Orden en que se muestran: primero lo que pide una acción hoy. */
export const ORDEN_COBERTURA: EstadoCobertura[] = ['urgente', 'pronto', 'sano', 'exceso', 'quieto']

/**
 * Cortes, en días.
 *
 * Una semana es lo que tarda en llegar un pedido a un distribuidor chico; un
 * mes es el ciclo normal de reposición; seis meses de existencias ya es
 * mercadería que inmoviliza plata y, en perecederos, que se echa a perder.
 */
export const LIMITES_COBERTURA = {
  urgente: 7,
  pronto: 30,
  exceso: 180,
} as const

/** Para cuántos días se sugiere reponer: un ciclo normal. */
export const OBJETIVO_DIAS = 30

/** Lo que se vende en promedio por día en la ventana medida. */
export function ventaDiaria(vendido: number, dias: number): number {
  if (!Number.isFinite(vendido) || !Number.isFinite(dias) || dias <= 0) return 0
  return Math.max(0, vendido) / dias
}

/**
 * Para cuántos días alcanza el stock al ritmo actual.
 *
 * Devuelve `null` cuando no hubo ventas: la cobertura es indefinida, no
 * "infinita". La diferencia importa porque esos productos no se comparan con
 * el resto por días —no tiene sentido decir "te alcanza para ∞"— sino que van
 * a su propio grupo.
 */
export function diasDeCobertura(stock: number, vendido: number, dias: number): number | null {
  const porDia = ventaDiaria(vendido, dias)
  if (porDia <= 0) return null
  return Math.max(0, Number.isFinite(stock) ? stock : 0) / porDia
}

export function estadoCobertura(stock: number, vendido: number, dias: number): EstadoCobertura {
  const cobertura = diasDeCobertura(stock, vendido, dias)
  if (cobertura === null) return 'quieto'
  if (cobertura < LIMITES_COBERTURA.urgente) return 'urgente'
  if (cobertura < LIMITES_COBERTURA.pronto) return 'pronto'
  if (cobertura <= LIMITES_COBERTURA.exceso) return 'sano'
  return 'exceso'
}

/**
 * Cuánto pedir para cubrir `objetivo` días al ritmo actual.
 *
 * Se redondea hacia arriba a unidades enteras: al distribuidor se le compra
 * de a libra o de a paquete, no 3.27. Antes de redondear se recorta el ruido
 * del punto flotante, porque 4 ÷ 30 × 30 da 4.0000000001 en binario, y un
 * `ceil` directo pediría 5 cuando hacen falta 4.
 */
export function cantidadParaCubrir(
  stock: number,
  vendido: number,
  dias: number,
  objetivo: number = OBJETIVO_DIAS,
): number {
  const porDia = ventaDiaria(vendido, dias)
  if (porDia <= 0) return 0
  const falta = porDia * objetivo - Math.max(0, stock)
  return Math.max(0, Math.ceil(Math.round(falta * 1e6) / 1e6))
}

/**
 * La cobertura dicha como la diría una persona.
 *
 * "767 días" es un número que hay que pensar; "2 años" se entiende de un
 * vistazo. Hasta dos meses se habla en días, porque ahí la precisión importa
 * para decidir cuándo pedir; más allá, la unidad grande dice lo que importa:
 * que sobra.
 */
export function textoCobertura(cobertura: number | null, stock: number): string {
  if (cobertura === null) return stock > 0 ? 'Sin ventas' : 'Agotado'
  if (stock <= 0) return 'Se acabó'
  if (cobertura < 1) return 'Menos de 1 día'
  if (cobertura < 60) {
    const d = Math.floor(cobertura)
    return d === 1 ? '1 día' : `${d} días`
  }
  if (cobertura < 730) return `${Math.round(cobertura / 30)} meses`
  return `${Math.round(cobertura / 365)} años`
}

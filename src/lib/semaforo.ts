/**
 * Reglas del semáforo de rotación.
 *
 * Es la regla central del producto: decide qué se repone y qué está por
 * estancarse. Vive acá, separada del hook que consulta la base, para poder
 * probarla sin depender de Supabase ni de React.
 *
 * La clasificación es por UNIDADES VENDIDAS en el período, no por stock: un
 * producto con mucha existencia y sin ventas es justamente el que hay que
 * detectar.
 */

export type NivelRotacion = 'alta' | 'media' | 'baja'

export type PeriodoDias = 7 | 15 | 30

/**
 * Mínimo de unidades vendidas para cada nivel, según el período.
 * Los umbrales crecen con la ventana: vender 7 unidades en una semana es
 * buena rotación, pero las mismas 7 en un mes no lo es.
 */
export const UMBRALES: Record<PeriodoDias, { alta: number; media: number }> = {
  7:  { alta: 7,  media: 3 },
  15: { alta: 12, media: 5 },
  30: { alta: 20, media: 7 },
}

/** Orden en que se muestran los grupos: primero lo que mejor rota. */
export const ORDEN_NIVELES: NivelRotacion[] = ['alta', 'media', 'baja']

/**
 * Clasifica un producto por las unidades que vendió en el período.
 *
 * Un producto sin ventas cae en 'baja', que es lo correcto: es el que hay que
 * mirar. La pantalla lo distingue después con la insignia "SIN VENTAS".
 */
export function calcularNivel(unidades: number, dias: PeriodoDias): NivelRotacion {
  const umbral = UMBRALES[dias]
  if (unidades >= umbral.alta) return 'alta'
  if (unidades >= umbral.media) return 'media'
  return 'baja'
}

/** ¿El producto no registró ninguna venta en el período? */
export function sinMovimiento(unidades: number): boolean {
  return unidades <= 0
}

/** Texto del umbral para la leyenda de la pantalla. */
export function etiquetaUmbral(nivel: NivelRotacion, dias: PeriodoDias): string {
  const umbral = UMBRALES[dias]
  if (nivel === 'alta') return `≥ ${umbral.alta} uds`
  if (nivel === 'media') return `${umbral.media}–${umbral.alta - 1} uds`
  return `1–${umbral.media - 1} uds`
}

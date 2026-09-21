/**
 * Junta una ráfaga de avisos en un solo refresco.
 *
 * Las pantallas se suscriben a los cambios de la base en tiempo real y se
 * recargan cuando llega uno. El problema aparece con volumen: una sola venta
 * de cinco productos dispara una inserción en `ventas`, cinco en
 * `detalle_ventas` y cinco actualizaciones de stock, y cada evento relanzaba
 * la pantalla completa. Midiendo contra un negocio de prueba a unas 70 ventas
 * por segundo, un Dashboard abierto intentaba miles de consultas por segundo;
 * con varias personas mirando, eso tumba el servicio.
 *
 * Esto convierte "un refresco por evento" en "un refresco por ráfaga":
 *
 *   · espera a que los eventos paren `esperaMs` antes de refrescar, así una
 *     venta con muchas líneas produce una sola recarga;
 *   · pero nunca deja pasar más de `maxEsperaMs` sin refrescar, para que una
 *     corriente continua de ventas no deje la pantalla congelada esperando
 *     un silencio que no llega.
 */

export interface LlamadaAgrupada {
  /** Avisa que hubo un cambio. Llamarla muchas veces seguidas es barato. */
  disparar: () => void
  /** Anula lo pendiente. Se llama al desmontar la pantalla. */
  cancelar: () => void
}

export function agruparLlamadas(
  fn: () => void,
  esperaMs: number,
  maxEsperaMs: number,
): LlamadaAgrupada {
  let temporizador: ReturnType<typeof setTimeout> | null = null
  let primeraPendiente: number | null = null

  const ejecutar = () => {
    temporizador = null
    primeraPendiente = null
    fn()
  }

  return {
    disparar() {
      const ahora = Date.now()
      primeraPendiente ??= ahora

      if (temporizador !== null) clearTimeout(temporizador)

      // Lo que resta hasta el tope, contado desde el PRIMER aviso de la
      // ráfaga: así el tope se cumple aunque los avisos no paren nunca.
      const restanteHastaTope = maxEsperaMs - (ahora - primeraPendiente)
      temporizador = setTimeout(ejecutar, Math.max(0, Math.min(esperaMs, restanteHastaTope)))
    },

    cancelar() {
      if (temporizador !== null) clearTimeout(temporizador)
      temporizador = null
      primeraPendiente = null
    },
  }
}

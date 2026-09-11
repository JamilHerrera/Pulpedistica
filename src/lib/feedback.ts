import type { Feedback } from '../types'

/** Límites del mensaje. Coinciden con la restricción de la base. */
export const MENSAJE_MIN = 10
export const MENSAJE_MAX = 2000

/**
 * ¿El comentario se puede enviar?
 *
 * La base tiene la misma restricción, así que esto no es la validación real:
 * evita el viaje de ida y vuelta y da un mensaje entendible.
 */
export function mensajeValido(mensaje: string): boolean {
  const largo = mensaje.trim().length
  return largo >= MENSAJE_MIN && largo <= MENSAJE_MAX
}

/** Promedio de los comentarios que traen puntaje. Null si ninguno lo trae. */
export function promedioCalificacion(comentarios: Feedback[]): number | null {
  const conNota = comentarios.filter((c) => c.calificacion !== null)
  if (conNota.length === 0) return null
  return conNota.reduce((s, c) => s + (c.calificacion ?? 0), 0) / conNota.length
}

/** Cuántos siguen sin atender. */
export function sinAtender(comentarios: Feedback[]): number {
  return comentarios.filter((c) => !c.atendido).length
}

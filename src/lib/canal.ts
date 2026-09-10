/**
 * Nombre único para un canal de realtime de Supabase.
 *
 * Antes se armaba con Math.random(), que Sonar marca como generador
 * pseudoaleatorio inseguro. Acá el valor no protege nada —solo evita que dos
 * pestañas abiertas colisionen en el mismo canal— pero usar crypto.randomUUID
 * es igual de simple, no deja la duda al leer el código y quita el aviso.
 */
export function nombreDeCanal(prefijo: string): string {
  return `${prefijo}-${crypto.randomUUID()}`
}

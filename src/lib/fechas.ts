/**
 * Días del calendario, contados en la hora del negocio.
 *
 * Existe por un error concreto: las pantallas agrupaban las ventas por
 * `fecha.toISOString().split('T')[0]`, que es la fecha en UTC. Honduras está
 * seis horas atrás, así que toda venta hecha después de las 6 de la tarde
 * caía en el día siguiente, y en una pulpería la tarde es cuando más se
 * vende. La base ahora agrupa en hora de Honduras (migración 017) y estas
 * funciones arman las claves del lado del navegador de la misma forma, para
 * que las dos puntas hablen del mismo día.
 */

/** 'AAAA-MM-DD' del día LOCAL de esa fecha, no del día en UTC. */
export function claveDia(fecha: Date): string {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

/** Las 00:00 locales del mismo día. No modifica la fecha que recibe. */
export function inicioDelDia(fecha: Date): Date {
  const copia = new Date(fecha)
  copia.setHours(0, 0, 0, 0)
  return copia
}

/**
 * Los últimos `n` días calendario, del más viejo al de hoy.
 *
 * Se resta por calendario (`setDate`) y no restando 24 horas: el día en que
 * cambia el horario, restar 86 400 000 ms salta un día o repite otro.
 */
export function ultimosDias(n: number, hoy: Date = new Date()): Date[] {
  const base = inicioDelDia(hoy)
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - (n - 1 - i))
    return d
  })
}

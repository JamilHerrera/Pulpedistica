import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import type { Ticket, EstadoTicket } from '../types'

/**
 * La bandeja de tickets, para quien da soporte.
 *
 * Solo lee y cambia el estado. El alta no pasa por acá: la hace sola
 * `lib/tickets.ts` contra la función `reportar_error`, porque los errores
 * ocurren en cualquier parte de la app, incluso cuando React ya se cayó y
 * ningún hook puede ejecutarse.
 */
export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const { data, error: err } = await consultaCacheada(
        'tickets:listado',
        async () =>
          await supabase
            .from('tickets')
            .select('*')
            // Por lo último que pasó, no por cuándo apareció: un bug viejo que
            // sigue disparándose importa más que uno nuevo que ocurrió una vez.
            .order('ultima_vez', { ascending: false })
            .limit(200),
        TTL.corto,
      )
      if (err) throw err
      setTickets((data ?? []) as Ticket[])
    } catch (e) {
      setError('No se pudieron cargar los tickets')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const refrescar = useCallback(async () => {
    invalidar('tickets')
    await fetchData()
  }, [fetchData])

  const cambiarEstado = useCallback(
    async (id: string, estado: EstadoTicket): Promise<boolean> => {
      try {
        // Condicional: si alguien más ya lo movió, esta llamada no pisa nada
        // y repetirla no vuelve a cambiar el estado.
        const { error: err } = await supabase
          .from('tickets')
          .update({ estado })
          .eq('id', id)
          .neq('estado', estado)
        if (err) throw err
        await refrescar()
        return true
      } catch (e) {
        console.error('Error cambiando el estado del ticket:', e)
        return false
      }
    },
    [refrescar],
  )

  useEffect(() => { fetchData() }, [fetchData])

  const abiertos = tickets.filter((t) => t.estado === 'nuevo' || t.estado === 'en_proceso')
  // Cuántas veces le pasó a alguien, no cuántos problemas distintos hay: es la
  // cifra que dice si la app está estable.
  const ocurrencias = tickets.reduce((suma, t) => suma + t.veces, 0)

  return {
    tickets, loading, error,
    abiertos: abiertos.length,
    ocurrencias,
    cambiarEstado,
    refetch: refrescar,
  }
}

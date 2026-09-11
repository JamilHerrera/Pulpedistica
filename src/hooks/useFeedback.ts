import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import type { Feedback, TipoFeedback } from '../types'

import { mensajeValido, promedioCalificacion, sinAtender, MENSAJE_MIN, MENSAJE_MAX } from '../lib/feedback'

export { MENSAJE_MIN, MENSAJE_MAX }

export function useFeedback() {
  const [comentarios, setComentarios] = useState<Feedback[]>([])
  const [esSoporte, setEsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [adminRes, listaRes] = await consultaCacheada(
        'feedback:listado',
        async () => await Promise.all([
          supabase.rpc('soy_soporte'),
          supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200),
        ]),
        TTL.corto,
      )

      if (listaRes.error) throw listaRes.error
      setEsAdmin(adminRes.data === true)
      // Las políticas ya filtran: un usuario común recibe solo lo suyo.
      setComentarios((listaRes.data ?? []) as Feedback[])
    } catch (e) {
      setError('No se pudieron cargar los comentarios')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const refrescar = useCallback(async () => {
    invalidar('feedback')
    await fetchData()
  }, [fetchData])

  const enviar = useCallback(
    async (
      tipo: TipoFeedback,
      mensaje: string,
      calificacion: number | null,
      pantalla: string,
    ): Promise<boolean> => {
      const texto = mensaje.trim()
      if (!mensajeValido(texto)) return false

      try {
        const { data: sesion } = await supabase.auth.getUser()
        const userId = sesion.user?.id
        if (!userId) return false

        const { error: err } = await supabase.from('feedback').insert({
          // La política exige que coincida con quien envía: no se puede
          // firmar un comentario a nombre de otro.
          user_id: userId,
          tipo,
          mensaje: texto,
          calificacion,
          pantalla,
        })
        if (err) throw err

        await refrescar()
        return true
      } catch (e) {
        console.error('Error enviando el comentario:', e)
        return false
      }
    },
    [refrescar],
  )

  const marcarAtendido = useCallback(
    async (id: string, atendido: boolean): Promise<boolean> => {
      try {
        // Condicional: repetir la acción no vuelve a cambiar el estado.
        const { error: err } = await supabase
          .from('feedback')
          .update({ atendido })
          .eq('id', id)
          .eq('atendido', !atendido)
        if (err) throw err
        await refrescar()
        return true
      } catch (e) {
        console.error('Error actualizando el comentario:', e)
        return false
      }
    },
    [refrescar],
  )

  useEffect(() => { fetchData() }, [fetchData])

  const pendientes = sinAtender(comentarios)
  const promedio = promedioCalificacion(comentarios)
  const conNota = comentarios.filter((c) => c.calificacion !== null)

  return {
    comentarios, esSoporte, loading, error,
    pendientes, promedio, totalConNota: conNota.length,
    enviar, marcarAtendido, refetch: refrescar,
  }
}

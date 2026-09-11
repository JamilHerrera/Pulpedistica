import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'

export type RolNegocio = 'admin' | 'empleado'

export interface Miembro {
  id: string
  nombre: string | null
  rol: RolNegocio
  created_at: string
}

export interface Invitacion {
  codigo: string
  rol: RolNegocio
  usada_por: string | null
  expira_en: string
  created_at: string
}

/**
 * Quién es el usuario dentro de su negocio.
 *
 * El rol se usa para no mostrar acciones que la base va a rechazar igual.
 * Esconder un botón NO es la seguridad: eso lo hacen las políticas y las
 * funciones. Acá solo se evita ofrecer algo que terminaría en error.
 */
export function usePerfil() {
  const [rol, setRol] = useState<RolNegocio>('empleado')
  const [esSoporte, setEsSoporte] = useState(false)
  const [nombreNegocio, setNombreNegocio] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPerfil = useCallback(async () => {
    try {
      const { data } = await consultaCacheada(
        'perfil:actual',
        async () => await supabase.auth.getUser(),
        TTL.medio,
      )
      const uid = data.user?.id
      if (!uid) return

      const [perfilRes, negocioRes] = await consultaCacheada(
        `perfil:${uid}`,
        async () => await Promise.all([
          supabase.from('perfiles').select('rol, es_soporte').eq('id', uid).single(),
          supabase.from('negocios').select('nombre').limit(1).single(),
        ]),
        TTL.medio,
      )

      if (perfilRes.data) {
        setRol((perfilRes.data.rol as RolNegocio) ?? 'empleado')
        setEsSoporte(perfilRes.data.es_soporte === true)
      }
      setNombreNegocio(negocioRes.data?.nombre ?? null)
    } catch (e) {
      console.error('Error leyendo el perfil:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPerfil() }, [fetchPerfil])

  return { rol, esAdmin: rol === 'admin', esSoporte, nombreNegocio, loading }
}

/** Miembros del negocio e invitaciones. Solo sirve para administradores. */
export function useEquipo() {
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [miembrosRes, invRes] = await consultaCacheada(
        'equipo:listado',
        async () => await Promise.all([
          supabase.from('perfiles').select('id, nombre, rol, created_at').order('created_at'),
          supabase.from('invitaciones').select('*').order('created_at', { ascending: false }).limit(20),
        ]),
        TTL.corto,
      )
      if (miembrosRes.error) throw miembrosRes.error
      setMiembros((miembrosRes.data ?? []) as Miembro[])
      setInvitaciones((invRes.data ?? []) as Invitacion[])
    } catch (e) {
      setError('No se pudo cargar el equipo')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const refrescar = useCallback(async () => {
    invalidar('equipo', 'perfil')
    await fetchData()
  }, [fetchData])

  const cambiarRol = useCallback(
    async (id: string, rol: RolNegocio): Promise<boolean> => {
      try {
        const { error: err } = await supabase.from('perfiles').update({ rol }).eq('id', id)
        if (err) throw err
        await refrescar()
        return true
      } catch (e) {
        console.error('Error cambiando el rol:', e)
        return false
      }
    },
    [refrescar],
  )

  const crearInvitacion = useCallback(
    async (rol: RolNegocio): Promise<string | null> => {
      try {
        const { data: sesion } = await supabase.auth.getUser()
        // Código corto y legible: se dicta en voz alta o se manda por mensaje.
        const codigo = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()

        const { error: err } = await supabase.from('invitaciones').insert({
          codigo,
          rol,
          creada_por: sesion.user?.id ?? null,
        })
        if (err) throw err
        await refrescar()
        return codigo
      } catch (e) {
        console.error('Error creando la invitación:', e)
        return null
      }
    },
    [refrescar],
  )

  useEffect(() => { fetchData() }, [fetchData])

  return { miembros, invitaciones, loading, error, cambiarRol, crearInvitacion, refetch: refrescar }
}

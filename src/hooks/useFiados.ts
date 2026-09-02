import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Cliente, Fiado } from '../types'

export function useFiados() {
  const [fiados, setFiados] = useState<Fiado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const channelName = useRef(`fiados-${Math.random().toString(36).slice(2)}`)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [fiadosRes, clientesRes] = await Promise.all([
        supabase
          .from('fiados')
          .select('*, clientes(id, nombre, telefono, notas, created_at)')
          .order('fecha_registro', { ascending: false }),
        supabase
          .from('clientes')
          .select('*')
          .order('nombre'),
      ])

      if (fiadosRes.error) throw fiadosRes.error
      if (clientesRes.error) throw clientesRes.error

      setFiados((fiadosRes.data ?? []) as unknown as Fiado[])
      setClientes((clientesRes.data ?? []) as Cliente[])
    } catch (e) {
      setError('Error cargando los fiados')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const crearCliente = useCallback(
    async (nombre: string, telefono?: string): Promise<Cliente | null> => {
      try {
        const { data, error: err } = await supabase
          .from('clientes')
          .insert({ nombre: nombre.trim(), telefono: telefono?.trim() || null })
          .select()
          .single()
        if (err) throw err
        await fetchData()
        return data as Cliente
      } catch (e) {
        console.error('Error creando cliente:', e)
        return null
      }
    },
    [fetchData],
  )

  const registrarFiado = useCallback(
    async (clienteId: string, monto: number): Promise<boolean> => {
      if (monto <= 0) return false
      try {
        const { error: err } = await supabase
          .from('fiados')
          .insert({ cliente_id: clienteId, monto })
        if (err) throw err
        await fetchData()
        return true
      } catch (e) {
        console.error('Error registrando fiado:', e)
        return false
      }
    },
    [fetchData],
  )

  // La base exige que `pagado` y `fecha_pago` viajen juntos
  // (constraint fiados_pago_coherente), por eso se escriben siempre a la par.
  const marcarPagado = useCallback(
    async (fiadoId: string, pagado: boolean): Promise<boolean> => {
      try {
        const { error: err } = await supabase
          .from('fiados')
          .update({ pagado, fecha_pago: pagado ? new Date().toISOString() : null })
          .eq('id', fiadoId)
        if (err) throw err
        await fetchData()
        return true
      } catch (e) {
        console.error('Error actualizando el fiado:', e)
        return false
      }
    },
    [fetchData],
  )

  const eliminarFiado = useCallback(
    async (fiadoId: string): Promise<boolean> => {
      try {
        const { error: err } = await supabase.from('fiados').delete().eq('id', fiadoId)
        if (err) throw err
        await fetchData()
        return true
      } catch (e) {
        console.error('Error eliminando el fiado:', e)
        return false
      }
    },
    [fetchData],
  )

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fiados' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, fetchData)
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const pendientes = fiados.filter((f) => !f.pagado)
  const totalAdeudado = pendientes.reduce((s, f) => s + Number(f.monto ?? 0), 0)
  const clientesConDeuda = new Set(pendientes.map((f) => f.cliente_id)).size

  return {
    fiados,
    clientes,
    loading,
    error,
    totalAdeudado,
    clientesConDeuda,
    pendientesCount: pendientes.length,
    crearCliente,
    registrarFiado,
    marcarPagado,
    eliminarFiado,
    refetch: fetchData,
  }
}

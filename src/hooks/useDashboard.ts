import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import type { DashboardStats, Venta } from '../types'

const STOCK_MIN = 5

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const channelName = useRef(`dashboard-${Math.random().toString(36).slice(2)}`)

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const finHoy = new Date()
      finHoy.setHours(23, 59, 59, 999)

      const inicioSemana = new Date()
      inicioSemana.setDate(inicioSemana.getDate() - 6)
      inicioSemana.setHours(0, 0, 0, 0)

      const [ventasHoyRes, semanaRes, productosRes, recientesRes, topRes] = await consultaCacheada(
        `dashboard:${hoy.toDateString()}`,
        () => Promise.all([
        // Métricas: excluir anuladas
        supabase
          .from('ventas')
          .select('id, monto_total')
          .gte('fecha_hora', hoy.toISOString())
          .lte('fecha_hora', finHoy.toISOString())
          .eq('anulada', false),

        supabase
          .from('ventas')
          .select('fecha_hora, monto_total')
          .gte('fecha_hora', inicioSemana.toISOString())
          .eq('anulada', false)
          .order('fecha_hora', { ascending: true }),

        supabase
          .from('productos')
          .select('id, stock_actual'),

        // Historial reciente: incluir anuladas (para mostrarlas con badge)
        supabase
          .from('ventas')
          .select('id, fecha_hora, monto_total, anulada, detalle_ventas(id, cantidad, subtotal, productos(nombre))')
          .order('fecha_hora', { ascending: false })
          .limit(5),

        supabase
          .from('detalle_ventas')
          .select('producto_id, cantidad, productos(nombre), ventas!inner(fecha_hora)')
          .gte('ventas.fecha_hora', inicioSemana.toISOString())
          .order('cantidad', { ascending: false })
          .limit(5),
        ]),
        TTL.corto,
      )

      const ventasHoy    = ventasHoyRes.data ?? []
      const ventasSemana = semanaRes.data ?? []
      const productos    = productosRes.data ?? []

      const montoHoy = ventasHoy.reduce((s, v) => s + (v.monto_total ?? 0), 0)
      const productosStockBajo = productos.filter((p) => p.stock_actual <= STOCK_MIN).length

      const ventasPorDia = Array(7).fill(0)
      ventasSemana.forEach((v) => {
        const dia = new Date(v.fecha_hora)
        const diff = Math.floor((Date.now() - dia.getTime()) / 86400000)
        const idx = 6 - Math.min(6, Math.max(0, diff))
        ventasPorDia[idx] += v.monto_total ?? 0
      })

      const topRaw = (topRes.data ?? []) as unknown as Array<{
        producto_id: string; cantidad: number; productos: { nombre: string } | null
      }>
      const topMap = new Map<string, { nombre: string; cantidad: number }>()
      topRaw.forEach((d) => {
        const nombre = d.productos?.nombre ?? 'Desconocido'
        const prev = topMap.get(nombre) ?? { nombre, cantidad: 0 }
        topMap.set(nombre, { nombre, cantidad: prev.cantidad + d.cantidad })
      })
      const topProductos = Array.from(topMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5)

      setStats({
        ventasHoy: ventasHoy.length,
        montoHoy,
        productosStockBajo,
        totalProductos: productos.length,
        ventasEsta_semana: ventasPorDia,
        topProductos,
        ventasRecientes: (recientesRes.data ?? []) as unknown as Venta[],
      })
    } catch (e) {
      setError('Error cargando datos del dashboard')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Anular venta. La funcion de base marca la venta y devuelve el stock en
  // una sola transaccion, y solo si todavia no estaba anulada: repetir la
  // llamada no vuelve a sumar mercaderia al inventario.
  const anularVenta = useCallback(async (ventaId: string): Promise<boolean> => {
    try {
      const { data: seAnulo, error } = await supabase.rpc('anular_venta', {
        p_venta_id: ventaId,
      })
      if (error) throw error

      invalidar('dashboard', 'ventas', 'productos', 'inventario', 'semaforo', 'analisis', 'estancados')
      await fetchStats()
      // `false` = ya estaba anulada. Para la pantalla el desenlace es el
      // mismo, asi que se informa exito igual.
      return seAnulo !== null
    } catch (e) {
      console.error('Error anulando venta:', e)
      return false
    }
  }, [fetchStats])

  useEffect(() => {
    fetchStats()

    // Sin invalidar primero, el refresco devolveria lo que ya hay en cache.
    const alCambiar = () => {
      invalidar('dashboard', 'ventas', 'productos')
      fetchStats()
    }

    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, alCambiar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detalle_ventas' }, alCambiar)
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats, anularVenta }
}

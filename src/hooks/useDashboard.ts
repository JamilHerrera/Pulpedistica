import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
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

      const [ventasHoyRes, semanaRes, productosRes, recientesRes, topRes] = await Promise.all([
        supabase
          .from('ventas')
          .select('id, monto_total')
          .gte('fecha_hora', hoy.toISOString())
          .lte('fecha_hora', finHoy.toISOString()),

        supabase
          .from('ventas')
          .select('fecha_hora, monto_total')
          .gte('fecha_hora', inicioSemana.toISOString())
          .order('fecha_hora', { ascending: true }),

        supabase
          .from('productos')
          .select('id, stock_actual'),

        supabase
          .from('ventas')
          .select('id, fecha_hora, monto_total, detalle_ventas(id, cantidad, subtotal, productos(nombre))')
          .order('fecha_hora', { ascending: false })
          .limit(5),

        supabase
          .from('detalle_ventas')
          .select('producto_id, cantidad, productos(nombre)')
          .gte('created_at' as never, inicioSemana.toISOString())
          .order('cantidad', { ascending: false })
          .limit(5),
      ])

      const ventasHoy = ventasHoyRes.data ?? []
      const ventasSemana = semanaRes.data ?? []
      const productos = productosRes.data ?? []

      const montoHoy = ventasHoy.reduce((s, v) => s + (v.monto_total ?? 0), 0)
      const productosStockBajo = productos.filter((p) => p.stock_actual <= STOCK_MIN).length

      const ventasPorDia = Array(7).fill(0)
      ventasSemana.forEach((v) => {
        const dia = new Date(v.fecha_hora)
        const diff = Math.floor((Date.now() - dia.getTime()) / 86400000)
        const idx = 6 - Math.min(6, Math.max(0, diff))
        ventasPorDia[idx] += v.monto_total ?? 0
      })

      const topRaw = (topRes.data ?? []) as Array<{ producto_id: string; cantidad: number; productos: { nombre: string } | null }>
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
        ventasRecientes: (recientesRes.data ?? []) as Venta[],
      })
    } catch (e) {
      setError('Error cargando datos del dashboard')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detalle_ventas' }, fetchStats)
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}

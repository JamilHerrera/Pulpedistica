import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface VentaDiaria { dia: string; monto: number; ventas: number }
export interface TopProducto { nombre: string; cantidad: number; subtotal: number }
export interface CategoriaStats { nombre: string; color: string; totalVentas: number; porcentaje: number }

export interface AnalisisData {
  ventasDiarias: VentaDiaria[]
  topProductos: TopProducto[]
  categoriaStats: CategoriaStats[]
  totalSemana: number
  promedioVenta: number
  totalVentas: number
}

export function useAnalisis() {
  const [data, setData] = useState<AnalisisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<7 | 14 | 30>(7)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const desde = new Date()
      desde.setDate(desde.getDate() - (periodo - 1))
      desde.setHours(0, 0, 0, 0)

      const [ventasRes, detallesRes] = await Promise.all([
        supabase
          .from('ventas')
          .select('id, fecha_hora, monto_total')
          .gte('fecha_hora', desde.toISOString())
          .order('fecha_hora', { ascending: true }),

        supabase
          .from('detalle_ventas')
          .select('cantidad, subtotal, productos(id, nombre, categorias(nombre, color_semaforo))')
          .gte('created_at' as never, desde.toISOString()),
      ])

      const ventas = ventasRes.data ?? []
      const detalles = (detallesRes.data ?? []) as Array<{
        cantidad: number
        subtotal: number
        productos: { id: string; nombre: string; categorias: { nombre: string; color_semaforo: string } | null } | null
      }>

      const diasMap = new Map<string, VentaDiaria>()
      for (let i = 0; i < periodo; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (periodo - 1 - i))
        const key = d.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric' })
        diasMap.set(d.toISOString().split('T')[0], { dia: key, monto: 0, ventas: 0 })
      }
      ventas.forEach((v) => {
        const key = v.fecha_hora.split('T')[0]
        if (diasMap.has(key)) {
          const d = diasMap.get(key)!
          d.monto += v.monto_total ?? 0
          d.ventas++
        }
      })

      const productoMap = new Map<string, TopProducto>()
      const catMap = new Map<string, { nombre: string; color: string; totalVentas: number }>()

      detalles.forEach((d) => {
        const nombre = d.productos?.nombre ?? 'Desconocido'
        const prev = productoMap.get(nombre) ?? { nombre, cantidad: 0, subtotal: 0 }
        productoMap.set(nombre, { nombre, cantidad: prev.cantidad + d.cantidad, subtotal: prev.subtotal + d.subtotal })

        const catNombre = d.productos?.categorias?.nombre ?? 'Sin categoría'
        const catColor = d.productos?.categorias?.color_semaforo ?? 'gris'
        const prevCat = catMap.get(catNombre) ?? { nombre: catNombre, color: catColor, totalVentas: 0 }
        catMap.set(catNombre, { ...prevCat, totalVentas: prevCat.totalVentas + d.subtotal })
      })

      const totalVentasCat = Array.from(catMap.values()).reduce((s, c) => s + c.totalVentas, 0)
      const categoriaStats: CategoriaStats[] = Array.from(catMap.values())
        .map((c) => ({ ...c, porcentaje: totalVentasCat > 0 ? (c.totalVentas / totalVentasCat) * 100 : 0 }))
        .sort((a, b) => b.totalVentas - a.totalVentas)

      const totalSemana = ventas.reduce((s, v) => s + (v.monto_total ?? 0), 0)
      const promedioVenta = ventas.length > 0 ? totalSemana / ventas.length : 0

      setData({
        ventasDiarias: Array.from(diasMap.values()),
        topProductos: Array.from(productoMap.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8),
        categoriaStats,
        totalSemana,
        promedioVenta,
        totalVentas: ventas.length,
      })
    } catch (e) {
      setError('Error cargando análisis')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { fetchData() }, [fetchData])

  return { data, loading, error, periodo, setPeriodo, refetch: fetchData }
}

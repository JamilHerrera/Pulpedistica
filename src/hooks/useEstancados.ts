import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, TTL } from '../lib/cache'

export interface ProductoEstancado {
  id: string
  nombre: string
  stock_actual: number
  categoria_id: string
  categorias?: { id: string; nombre: string } | null
  diasSinVenta: number
  ultimaVenta: Date | null
}

export function useEstancados() {
  const [estancados, setEstancados] = useState<ProductoEstancado[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      const hoy     = new Date()
      const desde30d = new Date(hoy.getTime() - 30 * 86_400_000).toISOString()

      // 1. Todos los productos con stock > 0
      const prodRes = await consultaCacheada('estancados:productos', () => supabase
        .from('productos')
        .select('id, nombre, stock_actual, categoria_id, categorias(id, nombre)')
        .gt('stock_actual', 0)
        .order('stock_actual', { ascending: false }), TTL.medio)

      if (prodRes.error) throw prodRes.error
      const productos = (prodRes.data ?? []) as any[]
      if (productos.length === 0) { setEstancados([]); return }

      // 2. Productos con ventas en los últimos 30 días
      const ventasRes = await supabase
        .from('ventas')
        .select('detalle_ventas(producto_id)')
        .gte('fecha_hora', desde30d)
        .eq('anulada', false)

      if (ventasRes.error) throw ventasRes.error

      const vendidosIds = new Set<string>()
      ;(ventasRes.data ?? []).forEach((v: any) => {
        ;(v.detalle_ventas ?? []).forEach((dv: any) => vendidosIds.add(dv.producto_id as string))
      })

      // 3. Estancados = stock > 0 Y sin ventas en 30 días
      const stagnant = productos.filter((p) => !vendidosIds.has(p.id))
      if (stagnant.length === 0) { setEstancados([]); return }

      const stagnantIds = stagnant.map((p) => p.id) as string[]

      // 4. Última fecha de venta para cada estancado (buscar en historial)
      const histRes = await supabase
        .from('detalle_ventas')
        .select('producto_id, venta_id')
        .in('producto_id', stagnantIds)

      let ventaDateMap = new Map<string, string>()   // venta_id → fecha_hora
      if (!histRes.error && histRes.data && histRes.data.length > 0) {
        const vIds = [...new Set(histRes.data.map((d: any) => d.venta_id as string))]
        const fechasRes = await supabase
          .from('ventas')
          .select('id, fecha_hora')
          .in('id', vIds)
          .eq('anulada', false)

        if (!fechasRes.error) {
          ;(fechasRes.data ?? []).forEach((v: any) => {
            ventaDateMap.set(v.id as string, v.fecha_hora as string)
          })
        }
      }

      // Mapa: producto_id → última fecha de venta
      const lastSaleMap = new Map<string, string>()
      ;(histRes.data ?? []).forEach((d: any) => {
        const fecha = ventaDateMap.get(d.venta_id as string)
        if (!fecha) return
        const prev = lastSaleMap.get(d.producto_id as string)
        if (!prev || fecha > prev) lastSaleMap.set(d.producto_id as string, fecha)
      })

      // 5. Construir resultado con días sin venta
      const resultado: ProductoEstancado[] = stagnant.map((p) => {
        const ultimaFecha = lastSaleMap.get(p.id)
        const ultimaVenta = ultimaFecha ? new Date(ultimaFecha) : null
        const diasSinVenta = ultimaVenta
          ? Math.floor((hoy.getTime() - ultimaVenta.getTime()) / 86_400_000)
          : 999  // nunca vendido

        return {
          id:           p.id,
          nombre:       p.nombre,
          stock_actual: p.stock_actual,
          categoria_id: p.categoria_id,
          categorias:   p.categorias ?? null,
          diasSinVenta,
          ultimaVenta,
        }
      })

      // Ordenar por más días sin venta primero
      resultado.sort((a, b) => b.diasSinVenta - a.diasSinVenta)
      setEstancados(resultado)
    } catch (e) {
      setError('Error cargando productos estancados')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { estancados, loading, error, refetch: fetchData }
}

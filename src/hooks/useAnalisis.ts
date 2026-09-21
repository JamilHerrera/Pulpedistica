import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, TTL } from '../lib/cache'
import { claveDia, ultimosDias } from '../lib/fechas'

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
      const dias = ultimosDias(periodo)
      const desde = dias[0].toISOString()

      // Tres consultas que devuelven filas YA SUMADAS por la base (migración
      // 017). Antes se bajaban todas las líneas de venta para sumarlas acá, y
      // la API corta en 1000 filas sin avisar: con más ventas que eso los
      // ingresos salían mal en silencio.
      const [porDiaRes, topRes, catRes] = await consultaCacheada(`analisis:${periodo}`, () => Promise.all([
        supabase.rpc('ventas_por_dia', { p_desde: desde }),
        supabase.rpc('top_productos', { p_desde: desde, p_limite: 8 }),
        supabase.rpc('ventas_por_categoria', { p_desde: desde }),
      ]), TTL.corto)

      if (porDiaRes.error) throw porDiaRes.error
      if (topRes.error) throw topRes.error
      if (catRes.error) throw catRes.error

      const porDia = new Map<string, { monto: number; ventas: number }>()
      for (const f of (porDiaRes.data ?? []) as { dia: string; monto: number; ventas: number }[]) {
        porDia.set(f.dia, { monto: Number(f.monto), ventas: Number(f.ventas) })
      }

      // El esqueleto de días se arma igual, para que un día sin ventas
      // aparezca en cero en vez de desaparecer del gráfico.
      const ventasDiarias: VentaDiaria[] = dias.map((d) => {
        const fila = porDia.get(claveDia(d))
        return {
          dia: d.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric' }),
          monto: fila?.monto ?? 0,
          ventas: fila?.ventas ?? 0,
        }
      })

      const topProductos: TopProducto[] = ((topRes.data ?? []) as { nombre: string; cantidad: number; subtotal: number }[])
        .map((t) => ({ nombre: t.nombre, cantidad: Number(t.cantidad), subtotal: Number(t.subtotal) }))

      const cats = ((catRes.data ?? []) as { nombre: string; color: string; total: number }[])
        .map((c) => ({ nombre: c.nombre, color: c.color, totalVentas: Number(c.total) }))
      const totalCat = cats.reduce((s, c) => s + c.totalVentas, 0)
      const categoriaStats: CategoriaStats[] = cats.map((c) => ({
        ...c,
        porcentaje: totalCat > 0 ? (c.totalVentas / totalCat) * 100 : 0,
      }))

      const totalSemana = ventasDiarias.reduce((s, d) => s + d.monto, 0)
      const totalVentas = ventasDiarias.reduce((s, d) => s + d.ventas, 0)

      setData({
        ventasDiarias,
        topProductos,
        categoriaStats,
        totalSemana,
        promedioVenta: totalVentas > 0 ? totalSemana / totalVentas : 0,
        totalVentas,
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

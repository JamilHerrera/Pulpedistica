import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, UnidadMedida } from '../types'

export interface ProductoPedido {
  id: string
  nombre: string
  stock_actual: number
  /** Cómo se cuenta: decide si el stock se muestra con decimales y unidad. */
  unidad?: UnidadMedida | null
  imagen_url?: string | null
  categoria_id: string
  categorias: Categoria | null
  unidades7d: number
  avgDiario: number
  sugerido: number
}

export function usePedidos() {
  const [categorias, setCategorias]         = useState<Categoria[]>([])
  const [todos, setTodos]                   = useState<ProductoPedido[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const [prodRes, catRes, ventasRes] = await Promise.all([
        supabase
          .from('productos')
          .select('id, nombre, stock_actual, unidad, imagen_url, categoria_id, categorias(id, nombre, color_semaforo)')
          .order('nombre'),
        supabase
          .from('categorias')
          .select('*')
          .order('nombre'),
        // Lo vendido por producto ya sumado en la base (migración 017), en vez
        // de bajar cada venta de la semana: la API corta en 1000 filas.
        supabase.rpc('rotacion_productos'),
      ])

      if (prodRes.error) throw prodRes.error
      if (catRes.error)  throw catRes.error
      if (ventasRes.error) throw ventasRes.error

      const salesMap = new Map<string, number>()
      for (const r of (ventasRes.data ?? []) as { producto_id: string; u7: number }[]) {
        salesMap.set(r.producto_id, Number(r.u7))
      }

      const productosConPedido: ProductoPedido[] = (prodRes.data ?? []).map((p: any) => {
        const u7d      = salesMap.get(p.id) ?? 0
        const avgDiario = u7d / 7
        // Sugerido: cubrir próximos 7 días de demanda, descontando el stock actual
        const sugerido = Math.max(0, Math.ceil(avgDiario * 7) - p.stock_actual)
        return {
          id:           p.id,
          nombre:       p.nombre,
          stock_actual: p.stock_actual,
          unidad:       p.unidad,
          imagen_url:   p.imagen_url,
          categoria_id: p.categoria_id,
          categorias:   p.categorias ?? null,
          unidades7d:   u7d,
          avgDiario,
          sugerido,
        }
      })

      setTodos(productosConPedido)
      setCategorias((catRes.data ?? []) as Categoria[])
    } catch (e) {
      setError('Error cargando sugerencias de pedido')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const productos = categoriaFiltro === 'todas'
    ? todos
    : todos.filter((p) => p.categoria_id === categoriaFiltro)

  const copiarResumen = async (): Promise<boolean> => {
    const pedido = productos.filter((p) => p.sugerido > 0)
    if (pedido.length === 0) return false

    const fecha    = new Date().toLocaleDateString('es-HN', { day: 'numeric', month: 'long', year: 'numeric' })
    const catNombre = categoriaFiltro === 'todas'
      ? 'Todos los productos'
      : (categorias.find((c) => c.id === categoriaFiltro)?.nombre ?? 'Categoría')

    const lineas = pedido
      .map((p) => `• ${p.nombre}: *${p.sugerido} uds* (stock: ${p.stock_actual})`)
      .join('\n')

    const texto =
      `📦 *Pedido — PulpeAnálisis*\n` +
      `📅 ${fecha}\n` +
      `🏪 ${catNombre}\n\n` +
      `${lineas}\n\n` +
      `_Generado automáticamente con PulpeAnálisis_`

    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      return false
    }
  }

  const totalSugeridos = productos.filter((p) => p.sugerido > 0).length

  return {
    categorias,
    productos,
    loading,
    error,
    categoriaFiltro,
    setCategoriaFiltro,
    copiarResumen,
    totalSugeridos,
    refetch: fetchData,
  }
}

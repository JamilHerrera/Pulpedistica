import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria } from '../types'

export interface ProductoPedido {
  id: string
  nombre: string
  stock_actual: number
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
      const desde7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

      const [prodRes, catRes, ventasRes] = await Promise.all([
        supabase
          .from('productos')
          .select('id, nombre, stock_actual, categoria_id, categorias(id, nombre, color_semaforo)')
          .order('nombre'),
        supabase
          .from('categorias')
          .select('*')
          .order('nombre'),
        supabase
          .from('ventas')
          .select('detalle_ventas(producto_id, cantidad)')
          .gte('fecha_hora', desde7d)
          .eq('anulada', false),
      ])

      if (prodRes.error) throw prodRes.error
      if (catRes.error)  throw catRes.error
      if (ventasRes.error) throw ventasRes.error

      // Acumular unidades vendidas por producto (últimos 7 días)
      const salesMap = new Map<string, number>()
      ;(ventasRes.data ?? []).forEach((v: any) => {
        ;(v.detalle_ventas ?? []).forEach((dv: any) => {
          const pid = dv.producto_id as string
          salesMap.set(pid, (salesMap.get(pid) ?? 0) + Number(dv.cantidad))
        })
      })

      const productosConPedido: ProductoPedido[] = (prodRes.data ?? []).map((p: any) => {
        const u7d      = salesMap.get(p.id) ?? 0
        const avgDiario = u7d / 7
        // Sugerido: cubrir próximos 7 días de demanda, descontando el stock actual
        const sugerido = Math.max(0, Math.ceil(avgDiario * 7) - p.stock_actual)
        return {
          id:           p.id,
          nombre:       p.nombre,
          stock_actual: p.stock_actual,
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

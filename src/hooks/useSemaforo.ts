import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Categoria, Producto } from '../types'

export interface CategoriaConProductos extends Categoria {
  productos: Producto[]
  totalStock: number
  stockBajo: number
}

export function useSemaforo() {
  const [categorias, setCategorias] = useState<CategoriaConProductos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const channelName = useRef(`semaforo-${Math.random().toString(36).slice(2)}`)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const { data: productos, error: err } = await supabase
        .from('productos')
        .select('*, categorias(*)')
        .order('nombre', { ascending: true })

      if (err) throw err

      const catMap = new Map<string, CategoriaConProductos>()

      ;(productos ?? []).forEach((p: Producto) => {
        const cat = p.categorias
        if (!cat) return
        if (!catMap.has(cat.id)) {
          catMap.set(cat.id, { ...cat, productos: [], totalStock: 0, stockBajo: 0 })
        }
        const entry = catMap.get(cat.id)!
        entry.productos.push(p)
        entry.totalStock += p.stock_actual
        if (p.stock_actual <= 5) entry.stockBajo++
      })

      const sorted = Array.from(catMap.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      )

      setCategorias(sorted)
      setLastUpdate(new Date())
    } catch (e) {
      setError('Error cargando semáforo')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, fetchData)
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  return { categorias, loading, error, lastUpdate, refetch: fetchData }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Producto, Categoria } from '../types'

export function useInventario() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const channelName = useRef(`inventario-${Math.random().toString(36).slice(2)}`)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [prodRes, catRes] = await Promise.all([
        supabase
          .from('productos')
          .select('*, categorias(id, nombre, color_semaforo)')
          .order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
      ])
      if (prodRes.error) throw prodRes.error
      if (catRes.error) throw catRes.error
      setProductos((prodRes.data ?? []) as Producto[])
      setCategorias((catRes.data ?? []) as Categoria[])
    } catch (e) {
      setError('Error cargando inventario')
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

  const actualizarStock = useCallback(async (id: string, nuevoStock: number): Promise<boolean> => {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('productos')
        .update({ stock_actual: nuevoStock })
        .eq('id', id)
      if (error) throw error
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, stock_actual: nuevoStock } : p)),
      )
      return true
    } catch (e) {
      console.error('Error actualizando stock:', e)
      return false
    } finally {
      setUpdatingId(null)
    }
  }, [])

  const agregarProducto = useCallback(
    async (nombre: string, stock_actual: number, categoria_id: string, precio?: number): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('productos')
          .insert({ nombre, stock_actual, categoria_id, ...(precio ? { precio } : {}) })
        if (error) throw error
        await fetchData()
        return true
      } catch (e) {
        console.error('Error agregando producto:', e)
        return false
      }
    },
    [fetchData],
  )

  const agregarCategoria = useCallback(
    async (nombre: string): Promise<string | null> => {
      try {
        const { data, error } = await supabase
          .from('categorias')
          .insert({ nombre, color_semaforo: 'verde' })
          .select()
          .single()
        if (error) {
          console.error('Supabase error al agregar categoría:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          })
          throw error
        }
        await fetchData()
        return data?.id ?? null
      } catch (e) {
        console.error('Error agregando categoría:', e)
        return null
      }
    },
    [fetchData],
  )

  return {
    productos,
    categorias,
    loading,
    error,
    updatingId,
    actualizarStock,
    agregarProducto,
    agregarCategoria,
    refetch: fetchData,
  }
}

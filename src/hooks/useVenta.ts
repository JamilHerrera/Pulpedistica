import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Producto, CartItem } from '../types'

export function useVenta() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [saving, setSaving] = useState(false)
  // Precios ya fijados en esta sesión, para que la UI los muestre al instante
  // sin esperar a releer el catálogo. La fuente de verdad es productos.precio.
  const [preciosLocales, setPreciosLocales] = useState<Record<string, number>>({})

  const searchProductos = useCallback(async (query: string): Promise<Producto[]> => {
    if (!query.trim()) return []
    const { data, error } = await supabase
      .from('productos')
      .select('*, categorias(nombre, color_semaforo)')
      .ilike('nombre', `%${query}%`)
      .order('nombre')
      .limit(10)
    if (error) throw error
    return (data ?? []) as Producto[]
  }, [])

  const addToCart = useCallback((producto: Producto, precio_unitario: number) => {
    setPreciosLocales((prev) => ({ ...prev, [producto.id]: precio_unitario }))

    // El precio pasa a ser parte del catálogo, no solo de esta venta.
    if (producto.precio !== precio_unitario) {
      supabase
        .from('productos')
        .update({ precio: precio_unitario })
        .eq('id', producto.id)
        .then(({ error }) => {
          if (error) console.error('No se pudo guardar el precio del producto:', error)
        })
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.producto.id === producto.id)
      if (existing) {
        return prev.map((i) =>
          i.producto.id === producto.id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i,
        )
      }
      return [...prev, { producto, cantidad: 1, precio_unitario }]
    })
  }, [])

  const updateCantidad = useCallback((productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      setCart((prev) => prev.filter((i) => i.producto.id !== productoId))
    } else {
      setCart((prev) =>
        prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad } : i)),
      )
    }
  }, [])

  const updatePrecio = useCallback((productoId: string, precio: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.producto.id === productoId ? { ...i, precio_unitario: precio } : i,
      ),
    )
  }, [])

  const removeFromCart = useCallback((productoId: string) => {
    setCart((prev) => prev.filter((i) => i.producto.id !== productoId))
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)

  const confirmarVenta = useCallback(async (): Promise<boolean> => {
    if (cart.length === 0) return false
    setSaving(true)
    try {
      const { data: venta, error: ventaErr } = await supabase
        .from('ventas')
        .insert({ monto_total: total, fecha_hora: new Date().toISOString() })
        .select()
        .single()

      if (ventaErr || !venta) throw ventaErr ?? new Error('No se pudo crear la venta')

      const detalles = cart.map((item) => ({
        venta_id: venta.id,
        producto_id: item.producto.id,
        cantidad: item.cantidad,
        subtotal: item.cantidad * item.precio_unitario,
      }))

      const { error: detalleErr } = await supabase.from('detalle_ventas').insert(detalles)
      if (detalleErr) throw detalleErr

      await Promise.all(
        cart.map((item) =>
          supabase
            .from('productos')
            .update({ stock_actual: Math.max(0, item.producto.stock_actual - item.cantidad) })
            .eq('id', item.producto.id),
        ),
      )

      setCart([])
      return true
    } catch (e) {
      console.error('Error confirmando venta:', e)
      return false
    } finally {
      setSaving(false)
    }
  }, [cart, total])

  /** Precio de catálogo del producto, o el fijado recién en esta sesión. */
  const getPrecio = useCallback(
    (producto: Producto) => preciosLocales[producto.id] ?? Number(producto.precio ?? 0),
    [preciosLocales],
  )

  // Top products by frequency in detalle_ventas (client-side aggregation)
  const getProductosFrecuentes = useCallback(async (): Promise<Producto[]> => {
    try {
      const { data, error } = await supabase
        .from('detalle_ventas')
        .select('producto_id, cantidad, productos(id, nombre, stock_actual, categoria_id, categorias(id, nombre, color_semaforo))')
        .limit(500)
      if (error) throw error

      const countMap = new Map<string, { producto: Producto; apariciones: number }>()
      ;(data ?? []).forEach((dv: any) => {
        if (!dv.productos) return
        const pid = dv.producto_id as string
        if (!countMap.has(pid)) {
          countMap.set(pid, { producto: dv.productos as Producto, apariciones: 0 })
        }
        countMap.get(pid)!.apariciones += Number(dv.cantidad) || 1
      })

      return Array.from(countMap.values())
        .sort((a, b) => b.apariciones - a.apariciones)
        .slice(0, 8)
        .map((e) => e.producto)
        .filter((p) => p.stock_actual > 0)
    } catch (e) {
      console.error('Error obteniendo frecuentes:', e)
      return []
    }
  }, [])

  // Register a free-amount sale (no product, no stock change)
  const registrarMontoLibre = useCallback(async (monto: number): Promise<boolean> => {
    if (monto <= 0) return false
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ventas')
        .insert({ monto_total: monto, fecha_hora: new Date().toISOString() })
      if (error) throw error
      return true
    } catch (e) {
      console.error('Error registrando monto libre:', e)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    cart,
    total,
    saving,
    addToCart,
    updateCantidad,
    updatePrecio,
    removeFromCart,
    clearCart,
    confirmarVenta,
    searchProductos,
    getPrecio,
    getProductosFrecuentes,
    registrarMontoLibre,
  }
}

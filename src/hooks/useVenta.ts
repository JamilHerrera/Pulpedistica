import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Producto, CartItem } from '../types'

const PRECIO_CACHE_KEY = 'pulpe_precios'

function loadPriceCache(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PRECIO_CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function savePriceCache(cache: Record<string, number>) {
  localStorage.setItem(PRECIO_CACHE_KEY, JSON.stringify(cache))
}

export function useVenta() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [saving, setSaving] = useState(false)
  const [priceCache, setPriceCache] = useState<Record<string, number>>(loadPriceCache)

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
    const newCache = { ...priceCache, [producto.id]: precio_unitario }
    setPriceCache(newCache)
    savePriceCache(newCache)

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
  }, [priceCache])

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

  const getCachedPrice = useCallback(
    (productoId: string) => priceCache[productoId] ?? 0,
    [priceCache],
  )

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
    getCachedPrice,
  }
}

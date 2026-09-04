import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import { insertarIdempotente, nuevaClave } from '../lib/idempotencia'
import type { Producto, CartItem } from '../types'

export function useVenta() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [saving, setSaving] = useState(false)
  // Precios ya fijados en esta sesión, para que la UI los muestre al instante
  // sin esperar a releer el catálogo. La fuente de verdad es productos.precio.
  const [preciosLocales, setPreciosLocales] = useState<Record<string, number>>({})

  // Una clave por intento de cobro. Se mantiene mientras el carrito siga
  // igual, así un segundo toque o un reintento del navegador registran la
  // MISMA venta en vez de duplicarla, y se renueva recien al vaciarse.
  const claveVenta = useRef(nuevaClave())

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
      // Una sola llamada transaccional: inserta la venta, su detalle y
      // descuenta el stock, o no hace nada. Repetirla con la misma clave
      // devuelve la venta ya registrada sin volver a descontar.
      const { error } = await supabase.rpc('registrar_venta', {
        p_idempotency_key: claveVenta.current,
        p_items: cart.map((item) => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        })),
      })
      if (error) throw error

      invalidar('ventas', 'productos', 'dashboard', 'semaforo', 'analisis', 'inventario', 'estancados')
      setCart([])
      claveVenta.current = nuevaClave()
      return true
    } catch (e) {
      console.error('Error confirmando venta:', e)
      return false
    } finally {
      setSaving(false)
    }
  }, [cart])

  const getPrecio = useCallback(
    (producto: Producto) => preciosLocales[producto.id] ?? Number(producto.precio ?? 0),
    [preciosLocales],
  )

  // Top products by frequency in detalle_ventas (client-side aggregation)
  const getProductosFrecuentes = useCallback(async (): Promise<Producto[]> => {
    try {
      const { data, error } = await consultaCacheada('venta:frecuentes', () => supabase
        .from('detalle_ventas')
        .select('producto_id, cantidad, productos(id, nombre, stock_actual, categoria_id, categorias(id, nombre, color_semaforo))')
        .limit(500), TTL.medio)
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
      await insertarIdempotente('ventas', { monto_total: monto }, claveVenta.current)
      invalidar('ventas', 'dashboard', 'analisis')
      claveVenta.current = nuevaClave()
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

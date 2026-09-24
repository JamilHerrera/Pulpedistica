import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import { nuevaClave } from '../lib/idempotencia'
import {
  redondearCantidad, cantidadValida, sumarPaso, totalDeVenta,
  limitarAlStock, hayExistencias,
} from '../lib/unidades'
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

  /**
   * Todo el catálogo, para mostrarlo entero en la pantalla de venta.
   *
   * Antes solo se llegaba a un producto escribiéndolo en el buscador o si ya
   * había sido vendido alguna vez, así que un producto recién cargado era
   * invisible hasta que alguien adivinaba su nombre. Se cachea porque el
   * catálogo de una pulpería cambia mucho menos seguido que sus ventas.
   */
  const listarCatalogo = useCallback(async (): Promise<Producto[]> => {
    const { data, error } = await consultaCacheada(
      'venta:catalogo',
      async () => await supabase
        .from('productos')
        .select('*, categorias(id, nombre, color_semaforo)')
        .order('nombre'),
      TTL.corto,
    )
    if (error) throw error
    return (data ?? []) as Producto[]
  }, [])

  /**
   * Agrega o suma un escalón, sin pasarse de lo que hay.
   *
   * Devuelve por qué no se pudo, para que la pantalla lo explique en vez de
   * quedarse muda: un botón que no responde parece una app rota.
   */
  const addToCart = useCallback((producto: Producto, precio_unitario: number, cantidadInicial?: number): 'ok' | 'agotado' | 'tope' => {
    if (!hayExistencias(producto.stock_actual)) return 'agotado'

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

    const enCarrito = cart.find((i) => i.producto.id === producto.id)
    if (enCarrito) {
      // Volver a tocarlo suma un escalón de SU unidad: uno más si se cuenta,
      // un cuarto de libra más si se pesa.
      const siguiente = limitarAlStock(
        sumarPaso(enCarrito.cantidad, producto.unidad, 1),
        producto.stock_actual,
        producto.unidad,
      )
      if (siguiente <= enCarrito.cantidad) return 'tope'

      setCart((prev) => prev.map((i) =>
        i.producto.id === producto.id ? { ...i, cantidad: siguiente } : i,
      ))
      return 'ok'
    }

    // Arranca en una unidad entera aunque se venda por peso: quien pide queso
    // pide "una libra" y después ajusta, no arranca en 0.25.
    const inicial = limitarAlStock(cantidadInicial ?? 1, producto.stock_actual, producto.unidad)
    if (inicial <= 0) return 'agotado'

    setCart((prev) => [...prev, { producto, cantidad: inicial, precio_unitario }])
    return 'ok'
  }, [cart])

  /**
   * Fija la cantidad de una línea.
   *
   * Cero o menos saca el producto del carrito, que es lo que la gente espera
   * al restar hasta el fondo. Lo demás se redondea según la unidad del
   * producto: pedir 2.5 de algo que se cuenta de a uno deja 2, y lo que no
   * llega a ser una cantidad válida se ignora en vez de escribir una basura.
   */
  const updateCantidad = useCallback((productoId: string, cantidad: number) => {
    setCart((prev) => {
      const linea = prev.find((i) => i.producto.id === productoId)
      if (!linea) return prev

      const pedida = redondearCantidad(cantidad, linea.producto.unidad)
      if (pedida <= 0) return prev.filter((i) => i.producto.id !== productoId)

      // Tope en lo que hay: la base rechaza la venta que se pasa, y enterarse
      // recién al cobrar, con el cliente enfrente, es la peor forma.
      const ajustada = limitarAlStock(pedida, linea.producto.stock_actual, linea.producto.unidad)
      if (ajustada <= 0) return prev.filter((i) => i.producto.id !== productoId)
      if (!cantidadValida(ajustada, linea.producto.unidad)) return prev

      return prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad: ajustada } : i))
    })
  }, [])

  /** Suma o resta un escalón de la unidad del producto. */
  const ajustarCantidad = useCallback((productoId: string, pasos: number) => {
    setCart((prev) => {
      const linea = prev.find((i) => i.producto.id === productoId)
      if (!linea) return prev

      const siguiente = limitarAlStock(
        sumarPaso(linea.cantidad, linea.producto.unidad, pasos),
        linea.producto.stock_actual,
        linea.producto.unidad,
      )
      if (siguiente <= 0) return prev.filter((i) => i.producto.id !== productoId)

      return prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad: siguiente } : i))
    })
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

  // Cada línea se redondea al centavo antes de sumarse, para que el total
  // coincida con lo que el cliente ve sumando los subtotales de la pantalla.
  const total = totalDeVenta(cart)

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

  /**
   * Cobra un monto escrito a mano, sin producto y sin tocar el stock.
   *
   * Va por una funcion y no por un insert directo porque `ventas` no tiene
   * politica de INSERT: se quito a proposito en la 012 para que toda venta
   * entre por una funcion que garantice el detalle y el descuento de stock.
   * Insertar directo devolvia 42501 desde entonces.
   */
  const registrarMontoLibre = useCallback(async (monto: number): Promise<boolean> => {
    if (monto <= 0) return false
    setSaving(true)
    try {
      const { error } = await supabase.rpc('registrar_monto_libre', {
        p_idempotency_key: claveVenta.current,
        p_monto: monto,
      })
      if (error) throw error

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
    ajustarCantidad,
    updatePrecio,
    removeFromCart,
    clearCart,
    confirmarVenta,
    listarCatalogo,
    getPrecio,
    registrarMontoLibre,
  }
}

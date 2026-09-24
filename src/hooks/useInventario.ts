import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { nombreDeCanal } from '../lib/canal'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import {
  DEPOSITO, motivoDeRechazo, reducirImagen, rutaDeFoto, rutaDesdeUrl,
} from '../lib/imagenes'
import type { ValoresProducto } from '../lib/producto'
import type { Producto, Categoria, UnidadMedida } from '../types'
import { agruparLlamadas } from '../lib/agrupar'

export function useInventario() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const channelName = useRef(nombreDeCanal('inventario'))

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [prodRes, catRes] = await consultaCacheada('inventario:listado', () => Promise.all([
        supabase
          .from('productos')
          .select('*, categorias(id, nombre, color_semaforo)')
          .order('nombre'),
        supabase.from('categorias').select('*').order('nombre'),
      ]), TTL.corto)
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
    // Cada venta actualiza el stock de cada producto que lleva: una venta de
    // cinco productos son cinco avisos. Se agrupan en una sola recarga, y se
    // invalida antes para no recibir lo que ya estaba en caché.
    const refresco = agruparLlamadas(() => {
      invalidar('inventario')
      fetchData()
    }, 800, 3000)
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, refresco.disparar)
      .subscribe()
    return () => {
      refresco.cancelar()
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

  /**
   * Sube la foto de un producto.
   *
   * Tres pasos, en este orden a propósito: se reduce la imagen, se sube con un
   * nombre nuevo, y recién entonces se apunta la fila a la dirección nueva. Si
   * algo falla a mitad de camino, el producto se queda con la foto que tenía
   * en vez de quedar apuntando a una que no existe.
   *
   * La foto anterior se borra al final. Que ese borrado falle no es motivo
   * para dar por fallida la operación: lo que el usuario pidió —ver su foto
   * nueva— ya ocurrió, y lo peor que queda es un archivo huérfano.
   */
  const subirFoto = useCallback(async (producto: Producto, archivo: File): Promise<string | null> => {
    setUpdatingId(producto.id)
    try {
      const rechazo = motivoDeRechazo(archivo.type, archivo.size)
      if (rechazo) return rechazo

      const { data: negocioId, error: errorNegocio } = await supabase.rpc('mi_negocio')
      if (errorNegocio) throw errorNegocio
      if (!negocioId) return 'No se pudo identificar tu negocio.'

      const reducida = await reducirImagen(archivo)
      const ruta = rutaDeFoto(negocioId as string, producto.id, reducida.type, Date.now())

      const { error: errorSubida } = await supabase.storage
        .from(DEPOSITO)
        .upload(ruta, reducida, { contentType: reducida.type, upsert: false })
      if (errorSubida) throw errorSubida

      const { data: publica } = supabase.storage.from(DEPOSITO).getPublicUrl(ruta)
      const imagen_url = publica.publicUrl

      const { error: errorFila } = await supabase
        .from('productos').update({ imagen_url }).eq('id', producto.id)
      if (errorFila) throw errorFila

      const anterior = rutaDesdeUrl(producto.imagen_url)
      if (anterior) await supabase.storage.from(DEPOSITO).remove([anterior])

      invalidar('inventario', 'productos', 'venta')
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, imagen_url } : p)))
      return null
    } catch (e) {
      console.error('Error subiendo la foto:', e)
      return 'No se pudo subir la foto. Revisá tu conexión.'
    } finally {
      setUpdatingId(null)
    }
  }, [])

  /** Quita la foto: primero la fila, después el archivo. */
  const quitarFoto = useCallback(async (producto: Producto): Promise<boolean> => {
    setUpdatingId(producto.id)
    try {
      const { error } = await supabase
        .from('productos').update({ imagen_url: null }).eq('id', producto.id)
      if (error) throw error

      const ruta = rutaDesdeUrl(producto.imagen_url)
      if (ruta) await supabase.storage.from(DEPOSITO).remove([ruta])

      invalidar('inventario', 'productos', 'venta')
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, imagen_url: null } : p)))
      return true
    } catch (e) {
      console.error('Error quitando la foto:', e)
      return false
    } finally {
      setUpdatingId(null)
    }
  }, [])

  /**
   * Guarda los cambios de la ficha de un producto.
   *
   * Recibe SOLO los campos que se tocaron (ver `cambiosDeProducto`), así que
   * no reescribe columnas que nadie editó. Devuelve `null` si salió bien, o el
   * motivo para mostrarlo; ningún campo de identidad es editable: `id` y
   * `negocio_id` no viajan nunca, y aunque viajaran las políticas del negocio
   * las rechazarían.
   */
  const editarProducto = useCallback(
    async (id: string, cambios: Partial<ValoresProducto>): Promise<string | null> => {
      if (Object.keys(cambios).length === 0) return null

      setUpdatingId(id)
      try {
        const { error } = await supabase.from('productos').update(cambios).eq('id', id)
        if (error) {
          // 23505: el índice único de nombre por negocio. La comprobación en
          // pantalla se adelanta, pero esta es la que manda, y cubre el caso
          // de que otra persona haya creado ese nombre hace un segundo.
          if (error.code === '23505') return 'Ya tenés otro producto con ese nombre.'
          throw error
        }

        invalidar('inventario', 'productos', 'semaforo', 'dashboard', 'estancados', 'venta', 'analisis')
        await fetchData()
        return null
      } catch (e) {
        console.error('Error editando el producto:', e)
        return 'No se pudo guardar. Revisá tu conexión.'
      } finally {
        setUpdatingId(null)
      }
    },
    [fetchData],
  )

  const agregarProducto = useCallback(
    // El precio no se guarda en productos: se captura por venta en
    // detalle_ventas.subtotal (ver el cache de precios en useVenta).
    async (
      nombre: string,
      stock_actual: number,
      categoria_id: string,
      unidad: UnidadMedida = 'unidad',
    ): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('productos')
          .insert({ nombre, stock_actual, categoria_id, unidad })
        if (error) throw error
        invalidar('inventario', 'productos', 'semaforo', 'dashboard', 'estancados', 'venta')
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
    editarProducto,
    subirFoto,
    quitarFoto,
    agregarProducto,
    agregarCategoria,
    refetch: fetchData,
  }
}

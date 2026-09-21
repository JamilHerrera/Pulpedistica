import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { consultaCacheada, TTL } from '../lib/cache'
import type { UnidadMedida } from '../types'

export interface ProductoEstancado {
  id: string
  nombre: string
  stock_actual: number
  /** Cómo se cuenta: decide si el stock se muestra con decimales y unidad. */
  unidad?: UnidadMedida | null
  imagen_url?: string | null
  categoria_id: string
  categorias?: { id: string; nombre: string } | null
  diasSinVenta: number
  ultimaVenta: Date | null
}

export function useEstancados() {
  const [estancados, setEstancados] = useState<ProductoEstancado[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)

      const hoy = new Date()

      // Antes esto eran cuatro consultas encadenadas, y la última armaba una
      // URL con el id de CADA venta histórica de los productos estancados:
      // con suficiente historial la dirección se pasaba del largo permitido y
      // la pantalla dejaba de cargar. Ahora la base devuelve, por producto, lo
      // vendido en 30 días y la fecha de su última venta (migración 017).
      const [prodRes, rotRes] = await Promise.all([
        consultaCacheada('estancados:productos', async () => await supabase
          .from('productos')
          .select('id, nombre, stock_actual, unidad, imagen_url, categoria_id, categorias(id, nombre)')
          .gt('stock_actual', 0)
          .order('stock_actual', { ascending: false }), TTL.medio),
        supabase.rpc('rotacion_productos'),
      ])

      if (prodRes.error) throw prodRes.error
      if (rotRes.error) throw rotRes.error

      const rotacion = new Map<string, { u30: number; ultima: string | null }>()
      for (const r of (rotRes.data ?? []) as { producto_id: string; u30: number; ultima_venta: string | null }[]) {
        rotacion.set(r.producto_id, { u30: Number(r.u30), ultima: r.ultima_venta })
      }

      // Estancado = tiene existencias y no se vendió nada en 30 días.
      const productos = (prodRes.data ?? []) as any[]
      const resultado: ProductoEstancado[] = productos
        .filter((p) => (rotacion.get(p.id)?.u30 ?? 0) === 0)
        .map((p) => {
          const ultima = rotacion.get(p.id)?.ultima ?? null
          const ultimaVenta = ultima ? new Date(ultima) : null
          const diasSinVenta = ultimaVenta
            ? Math.floor((hoy.getTime() - ultimaVenta.getTime()) / 86_400_000)
            : 999  // nunca vendido

          return {
            id:           p.id,
            nombre:       p.nombre,
            stock_actual: p.stock_actual,
            unidad:       p.unidad,
            imagen_url:   p.imagen_url,
            categoria_id: p.categoria_id,
            categorias:   p.categorias ?? null,
            diasSinVenta,
            ultimaVenta,
          }
        })

      // Ordenar por más días sin venta primero
      resultado.sort((a, b) => b.diasSinVenta - a.diasSinVenta)
      setEstancados(resultado)
    } catch (e) {
      setError('Error cargando productos estancados')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return { estancados, loading, error, refetch: fetchData }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { nombreDeCanal } from '../lib/canal'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import { calcularNivel, ORDEN_NIVELES, type NivelRotacion } from '../lib/semaforo'
import {
  diasDeCobertura, estadoCobertura, cantidadParaCubrir, ORDEN_COBERTURA,
  type EstadoCobertura,
} from '../lib/cobertura'
import type { UnidadMedida } from '../types'
import { agruparLlamadas } from '../lib/agrupar'

export type { NivelRotacion, EstadoCobertura }

export interface ProductoConRotacion {
  id: string
  nombre: string
  stock_actual: number
  /** Cómo se cuenta: decide si el stock se muestra con decimales y unidad. */
  unidad?: UnidadMedida | null
  imagen_url?: string | null
  categoria_id: string
  categorias?: { id: string; nombre: string } | null
  unidades7d: number
  unidades15d: number
  unidades30d: number
  rotacion: NivelRotacion
  /** Días que alcanza el stock al ritmo del período. `null` si no hubo ventas. */
  cobertura: number | null
  estadoCobertura: EstadoCobertura
  /** Cuánto pedir para cubrir un mes. Cero si ya alcanza o si no se vende. */
  sugerido: number
}

export interface GrupoCobertura {
  estado: EstadoCobertura
  productos: ProductoConRotacion[]
}

export interface GrupoRotacion {
  nivel: NivelRotacion
  productos: ProductoConRotacion[]
  totalUnidades: number
}

export interface TotalesSemaforo {
  productos: number
  vendidos7d: number
  vendidos15d: number
  vendidos30d: number
  sinMovimiento: number
}

export function useSemaforo() {
  const [periodo, setPeriodo] = useState<7 | 15 | 30>(30)
  const [grupos, setGrupos] = useState<GrupoRotacion[]>([])
  const [gruposCobertura, setGruposCobertura] = useState<GrupoCobertura[]>([])
  const [totales, setTotales] = useState<TotalesSemaforo>({ productos: 0, vendidos7d: 0, vendidos15d: 0, vendidos30d: 0, sinMovimiento: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const channelName = useRef(nombreDeCanal('semaforo'))
  const fetchDataRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      // La base devuelve una fila por producto con lo vendido en 7/15/30 días
      // (migración 017). Antes se bajaban todas las ventas del mes con sus
      // líneas para sumarlas acá, y la API corta en 1000 filas sin avisar:
      // una pulpería con más de 1000 ventas al mes veía la rotación mal.
      const [prodRes, rotRes] = await consultaCacheada(`semaforo:${periodo}`, () => Promise.all([
        supabase
          .from('productos')
          .select('id, nombre, stock_actual, unidad, imagen_url, categoria_id, categorias(id, nombre)')
          .order('nombre'),
        supabase.rpc('rotacion_productos'),
      ]), TTL.corto)

      if (prodRes.error) throw prodRes.error
      if (rotRes.error)  throw rotRes.error

      const map7d  = new Map<string, number>()
      const map15d = new Map<string, number>()
      const map30d = new Map<string, number>()
      for (const r of (rotRes.data ?? []) as { producto_id: string; u7: number; u15: number; u30: number }[]) {
        map7d.set(r.producto_id,  Number(r.u7))
        map15d.set(r.producto_id, Number(r.u15))
        map30d.set(r.producto_id, Number(r.u30))
      }

      const unidadesPeriodo = (pid: string) => {
        if (periodo === 7)  return map7d.get(pid)  ?? 0
        if (periodo === 15) return map15d.get(pid) ?? 0
        return map30d.get(pid) ?? 0
      }

      const allProds: ProductoConRotacion[] = (prodRes.data ?? []).map((p: any) => {
        const u7  = map7d.get(p.id)  ?? 0
        const u15 = map15d.get(p.id) ?? 0
        const u30 = map30d.get(p.id) ?? 0
        return {
          id:           p.id,
          nombre:       p.nombre,
          stock_actual: p.stock_actual,
          // Sin esto la pantalla mostraba el stock sin la unidad ("2.5" en vez
          // de "2.5 lb"): la consulta la traía pero se perdía acá.
          unidad:       p.unidad,
          imagen_url:   p.imagen_url,
          categoria_id: p.categoria_id,
          categorias:   p.categorias,
          unidades7d:   u7,
          unidades15d:  u15,
          unidades30d:  u30,
          rotacion:     calcularNivel(unidadesPeriodo(p.id), periodo),
          // El mismo ritmo de ventas que la rotación, cruzado con el stock.
          cobertura:       diasDeCobertura(p.stock_actual, unidadesPeriodo(p.id), periodo),
          estadoCobertura: estadoCobertura(p.stock_actual, unidadesPeriodo(p.id), periodo),
          sugerido:        cantidadParaCubrir(p.stock_actual, unidadesPeriodo(p.id), periodo),
        }
      })

      const nuevosGrupos: GrupoRotacion[] = ORDEN_NIVELES.map((nivel) => {
        const prods = allProds
          .filter((p) => p.rotacion === nivel)
          .sort((a, b) => unidadesPeriodo(b.id) - unidadesPeriodo(a.id))
        return {
          nivel,
          productos: prods,
          totalUnidades: prods.reduce((s, p) => s + unidadesPeriodo(p.id), 0),
        }
      })

      // Cada grupo se ordena por lo que pide la acción: lo que se acaba antes
      // primero; lo que más sobra primero; lo quieto, por cuánto hay parado.
      const nuevosCobertura: GrupoCobertura[] = ORDEN_COBERTURA.map((estado) => {
        const prods = allProds.filter((p) => p.estadoCobertura === estado)
        if (estado === 'exceso') prods.sort((a, b) => (b.cobertura ?? 0) - (a.cobertura ?? 0))
        else if (estado === 'quieto') prods.sort((a, b) => b.stock_actual - a.stock_actual)
        else prods.sort((a, b) => (a.cobertura ?? 0) - (b.cobertura ?? 0))
        return { estado, productos: prods }
      })

      const sinMov = allProds.filter((p) => unidadesPeriodo(p.id) === 0).length
      setGrupos(nuevosGrupos)
      setGruposCobertura(nuevosCobertura)
      setTotales({
        productos:     allProds.length,
        vendidos7d:    Array.from(map7d.values()).reduce((s, v) => s + v, 0),
        vendidos15d:   Array.from(map15d.values()).reduce((s, v) => s + v, 0),
        vendidos30d:   Array.from(map30d.values()).reduce((s, v) => s + v, 0),
        sinMovimiento: sinMov,
      })
      setLastUpdate(new Date())
    } catch (e) {
      setError('Error cargando semáforo')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [periodo])

  // Mantener ref actualizada para que la suscripción siempre llame la versión más reciente
  useEffect(() => {
    fetchDataRef.current = fetchData
  })

  // Re-fetch cuando cambia el período
  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Suscripción en tiempo real (solo se crea una vez)
  useEffect(() => {
    // Hay que invalidar ANTES de recargar: sin eso la recarga devolvía lo que
    // ya estaba en caché, y el tiempo real no mostraba nada nuevo hasta que
    // la caché vencía sola. Y agrupado, para que una ráfaga de ventas
    // produzca una recarga y no una por evento.
    const refresco = agruparLlamadas(() => {
      invalidar('semaforo')
      fetchDataRef.current()
    }, 800, 3000)

    // Solo `ventas`: el detalle viaja en la misma transacción que su venta.
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, refresco.disparar)
      .subscribe()
    return () => {
      refresco.cancelar()
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  return { grupos, gruposCobertura, totales, loading, error, lastUpdate, periodo, setPeriodo, refetch: fetchData } as const
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type NivelRotacion = 'alta' | 'media' | 'baja'

export interface ProductoConRotacion {
  id: string
  nombre: string
  stock_actual: number
  categoria_id: string
  categorias?: { id: string; nombre: string } | null
  unidades7d: number
  unidades15d: number
  unidades30d: number
  rotacion: NivelRotacion
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

// Umbrales de unidades vendidas para clasificar rotación
const UMBRALES = {
  7:  { alta: 7,  media: 3 },
  15: { alta: 12, media: 5 },
  30: { alta: 20, media: 7 },
} as const

function calcularNivel(unidades: number, dias: 7 | 15 | 30): NivelRotacion {
  const u = UMBRALES[dias]
  if (unidades >= u.alta)  return 'alta'
  if (unidades >= u.media) return 'media'
  return 'baja'  // includes 0-sale products (shown with SIN VENTAS badge)
}

const ORDEN_NIVELES: NivelRotacion[] = ['alta', 'media', 'baja']

export function useSemaforo() {
  const [periodo, setPeriodo] = useState<7 | 15 | 30>(30)
  const [grupos, setGrupos] = useState<GrupoRotacion[]>([])
  const [totales, setTotales] = useState<TotalesSemaforo>({ productos: 0, vendidos7d: 0, vendidos15d: 0, vendidos30d: 0, sinMovimiento: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const channelName = useRef(`semaforo-${Math.random().toString(36).slice(2)}`)
  const fetchDataRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const now    = Date.now()
      const desde30d = new Date(now - 30 * 86_400_000).toISOString()
      const desde15d = new Date(now - 15 * 86_400_000).toISOString()
      const desde7d  = new Date(now -  7 * 86_400_000).toISOString()

      const [prodRes, ventasRes] = await Promise.all([
        supabase
          .from('productos')
          .select('id, nombre, stock_actual, categoria_id, categorias(id, nombre)')
          .order('nombre'),
        supabase
          .from('ventas')
          .select('fecha_hora, detalle_ventas(producto_id, cantidad)')
          .gte('fecha_hora', desde30d)
          .eq('anulada', false),
      ])

      if (prodRes.error)   throw prodRes.error
      if (ventasRes.error) throw ventasRes.error

      const map7d  = new Map<string, number>()
      const map15d = new Map<string, number>()
      const map30d = new Map<string, number>()

      ;(ventasRes.data ?? []).forEach((v: any) => {
        ;(v.detalle_ventas ?? []).forEach((dv: any) => {
          const pid = dv.producto_id as string
          const qty = Number(dv.cantidad) || 0
          map30d.set(pid, (map30d.get(pid) ?? 0) + qty)
          if (v.fecha_hora >= desde15d) map15d.set(pid, (map15d.get(pid) ?? 0) + qty)
          if (v.fecha_hora >= desde7d)  map7d.set(pid,  (map7d.get(pid)  ?? 0) + qty)
        })
      })

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
          categoria_id: p.categoria_id,
          categorias:   p.categorias,
          unidades7d:   u7,
          unidades15d:  u15,
          unidades30d:  u30,
          rotacion:     calcularNivel(unidadesPeriodo(p.id), periodo),
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

      const sinMov = allProds.filter((p) => unidadesPeriodo(p.id) === 0).length
      setGrupos(nuevosGrupos)
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
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' },
        () => fetchDataRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detalle_ventas' },
        () => fetchDataRef.current())
      .subscribe()
    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [])

  return { grupos, totales, loading, error, lastUpdate, periodo, setPeriodo, refetch: fetchData } as const
}

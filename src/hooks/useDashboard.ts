import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { nombreDeCanal } from '../lib/canal'
import { consultaCacheada, invalidar, TTL } from '../lib/cache'
import { claveDia, ultimosDias } from '../lib/fechas'
import type { DashboardStats, Venta } from '../types'
import { agruparLlamadas } from '../lib/agrupar'

const STOCK_MIN = 5

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const channelName = useRef(nombreDeCanal('dashboard'))

  const fetchStats = useCallback(async () => {
    try {
      setError(null)
      // Siete días calendario en hora local, del más viejo a hoy.
      const semana = ultimosDias(7)
      const claveHoy = claveDia(semana[6])
      const desde = semana[0].toISOString()

      const [porDiaRes, totalProdRes, stockBajoRes, recientesRes, topRes] = await consultaCacheada(
        `dashboard:${claveHoy}`,
        () => Promise.all([
        // Totales por día ya sumados en la base (migración 017), en vez de
        // bajar cada venta de la semana: la API corta en 1000 filas sin
        // avisar, y un día de mucho movimiento dejaba "Ventas hoy" en menos.
        supabase.rpc('ventas_por_dia', { p_desde: desde }),

        // Solo hacen falta dos números, así que se piden CONTEOS (`head: true`
        // no trae filas). Bajar la lista entera para contarla se cortaba en
        // 1000, y con un catálogo grande el total salía mal.
        supabase.from('productos').select('id', { count: 'exact', head: true }),
        supabase.from('productos').select('id', { count: 'exact', head: true }).lte('stock_actual', STOCK_MIN),

        // Historial reciente: incluir anuladas (para mostrarlas con badge)
        supabase
          .from('ventas')
          .select('id, fecha_hora, monto_total, anulada, detalle_ventas(id, cantidad, subtotal, productos(nombre, unidad))')
          .order('fecha_hora', { ascending: false })
          .limit(5),

        // Agrupa por producto y RECIÉN DESPUÉS corta en 5. Antes se pedían
        // las 5 líneas de venta más grandes y se agrupaban esas cinco, así
        // que el "top 5" eran las cinco ventas individuales mayores, no los
        // cinco productos que más se vendieron.
        supabase.rpc('top_productos', { p_desde: desde, p_limite: 5 }),
        ]),
        TTL.corto,
      )

      if (porDiaRes.error) throw porDiaRes.error
      if (topRes.error) throw topRes.error

      const porDia = new Map<string, { monto: number; ventas: number }>()
      for (const f of (porDiaRes.data ?? []) as { dia: string; monto: number; ventas: number }[]) {
        porDia.set(f.dia, { monto: Number(f.monto), ventas: Number(f.ventas) })
      }

      if (totalProdRes.error) throw totalProdRes.error
      if (stockBajoRes.error) throw stockBajoRes.error
      const ventasPorDia = semana.map((d) => porDia.get(claveDia(d))?.monto ?? 0)
      const deHoy = porDia.get(claveHoy)

      const topProductos = ((topRes.data ?? []) as { nombre: string; cantidad: number }[])
        .map((t) => ({ nombre: t.nombre, cantidad: Number(t.cantidad) }))

      setStats({
        ventasHoy: deHoy?.ventas ?? 0,
        montoHoy: deHoy?.monto ?? 0,
        productosStockBajo: stockBajoRes.count ?? 0,
        totalProductos: totalProdRes.count ?? 0,
        ventasEsta_semana: ventasPorDia,
        topProductos,
        ventasRecientes: (recientesRes.data ?? []) as unknown as Venta[],
      })
    } catch (e) {
      setError('Error cargando datos del dashboard')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  // Anular venta. La funcion de base marca la venta y devuelve el stock en
  // una sola transaccion, y solo si todavia no estaba anulada: repetir la
  // llamada no vuelve a sumar mercaderia al inventario.
  const anularVenta = useCallback(async (ventaId: string): Promise<boolean> => {
    try {
      const { data: seAnulo, error } = await supabase.rpc('anular_venta', {
        p_venta_id: ventaId,
      })
      if (error) throw error

      invalidar('dashboard', 'ventas', 'productos', 'inventario', 'semaforo', 'analisis', 'estancados')
      await fetchStats()
      // `false` = ya estaba anulada. Para la pantalla el desenlace es el
      // mismo, asi que se informa exito igual.
      return seAnulo !== null
    } catch (e) {
      console.error('Error anulando venta:', e)
      return false
    }
  }, [fetchStats])

  useEffect(() => {
    fetchStats()

    // Sin invalidar primero, el refresco devolveria lo que ya hay en cache.
    // Y agrupado: una rafaga de ventas produce UNA recarga, no una por evento
    // (ver lib/agrupar.ts, donde esta medido por que hace falta).
    const refresco = agruparLlamadas(() => {
      invalidar('dashboard', 'ventas', 'productos')
      fetchStats()
    }, 800, 3000)

    // Solo `ventas`: el detalle se escribe en la misma transaccion que su
    // venta, asi que escuchar `detalle_ventas` repetia el aviso una vez por
    // cada producto de la venta, sin aportar nada.
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, refresco.disparar)
      .subscribe()

    return () => {
      refresco.cancelar()
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats, anularVenta }
}

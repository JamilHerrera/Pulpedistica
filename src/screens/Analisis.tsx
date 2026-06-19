import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  TrendingUp, ShoppingBag, BarChart2, RefreshCw, Calendar,
  ClipboardCopy, Check, Package, ChevronDown, AlertTriangle,
} from 'lucide-react'
import { useAnalisis } from '../hooks/useAnalisis'
import { usePedidos } from '../hooks/usePedidos'
import { SkeletonStats, SkeletonList } from '../components/ui/SkeletonCard'

// ─── Tooltip del gráfico ───────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs border border-white/10">
      <p className="text-white/60">{label}</p>
      <p className="text-white font-bold">L {payload[0].value.toFixed(2)}</p>
    </div>
  )
}

// ─── Tab Estadísticas ──────────────────────────────────────────────────────────

function TabEstadisticas() {
  const { data, loading, error, periodo, setPeriodo, refetch } = useAnalisis()

  const PERIODS: { value: 7 | 14 | 30; label: string }[] = [
    { value: 7,  label: '7 días'  },
    { value: 14, label: '14 días' },
    { value: 30, label: '30 días' },
  ]

  const semaphoreColors: Record<string, string> = {
    verde: '#10B981', amarillo: '#F59E0B', rojo: '#EF4444',
    azul: '#06B6D4',  morado: '#7C3AED',   gris: '#6B7280',
  }

  return (
    <div className="space-y-4">
      {/* Selector período */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              periodo === p.value ? 'bg-brand text-white shadow-glow-brand' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            <Calendar size={11} /> {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm">Reintentar</button>
        </div>
      ) : loading ? (
        <>
          <div className="skeleton h-44 w-full rounded-2xl" />
          <SkeletonStats />
        </>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card p-3 text-center">
              <p className="stat-label text-[10px]">Ingresos</p>
              <p className="text-base font-black text-white mt-1">
                L {data.totalSemana >= 1000
                  ? `${(data.totalSemana / 1000).toFixed(1)}k`
                  : data.totalSemana.toFixed(0)}
              </p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="stat-label text-[10px]">Ventas</p>
              <p className="text-base font-black text-white mt-1">{data.totalVentas}</p>
            </div>
            <div className="glass-card p-3 text-center">
              <p className="stat-label text-[10px]">Promedio</p>
              <p className="text-base font-black text-white mt-1">L {data.promedioVenta.toFixed(0)}</p>
            </div>
          </div>

          {/* Gráfico */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} className="text-brand-light" />
              <p className="text-white font-semibold text-sm">Ventas por día</p>
            </div>
            {data.ventasDiarias.every((d) => d.monto === 0) ? (
              <div className="h-32 flex items-center justify-center">
                <p className="text-white/30 text-sm">Sin ventas en este período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.ventasDiarias} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                    {data.ventasDiarias.map((_, i) => (
                      <Cell key={i}
                        fill={i === data.ventasDiarias.length - 1
                          ? '#7C3AED'
                          : `rgba(124,58,237,${0.3 + (i / data.ventasDiarias.length) * 0.3})`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top productos */}
          {data.topProductos.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-accent" />
                <p className="text-white font-semibold text-sm">Productos más vendidos</p>
              </div>
              <div className="space-y-3">
                {data.topProductos.map((p, i) => {
                  const max = data.topProductos[0]?.cantidad ?? 1
                  const pct = (p.cantidad / max) * 100
                  return (
                    <div key={p.nombre} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-white/50' : 'text-white/25'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white text-xs font-medium truncate">{p.nombre}</p>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-white/40 text-xs">{p.cantidad} uds</span>
                            <span className="text-success text-xs font-bold">L {p.subtotal.toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand to-accent rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Por categoría */}
          {data.categoriaStats.length > 0 && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag size={16} className="text-warning" />
                <p className="text-white font-semibold text-sm">Por categoría</p>
              </div>
              <div className="space-y-3">
                {data.categoriaStats.map((c) => {
                  const color = semaphoreColors[c.color?.toLowerCase()] ?? '#6B7280'
                  return (
                    <div key={c.nombre}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-white/70 text-xs font-medium">{c.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs">{c.porcentaje.toFixed(1)}%</span>
                          <span className="text-white text-xs font-bold">L {c.totalVentas.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${c.porcentaje}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {data.topProductos.length === 0 && data.categoriaStats.length === 0 && (
            <div className="text-center py-12">
              <BarChart2 size={36} className="text-white/15 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Sin datos para este período</p>
              <p className="text-white/25 text-xs mt-1">Registra ventas para ver estadísticas</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─── Tab Sugerencia de Pedidos ─────────────────────────────────────────────────

function TabPedidos() {
  const {
    categorias, productos, loading, error,
    categoriaFiltro, setCategoriaFiltro,
    copiarResumen, totalSugeridos, refetch,
  } = usePedidos()

  const [copied, setCopied] = useState(false)

  const handleCopiar = async () => {
    const ok = await copiarResumen()
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const necesitanPedido  = productos.filter((p) => p.sugerido > 0)
  const stockSuficiente  = productos.filter((p) => p.sugerido === 0)

  return (
    <div className="space-y-4">
      {/* Filtro por categoría (actúa como proveedor) */}
      <div>
        <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">
          Filtrar por categoría / proveedor
        </label>
        <div className="relative">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="input-field appearance-none pr-8"
          >
            <option value="todas">Todos los productos</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Botón copiar resumen */}
      {!loading && totalSugeridos > 0 && (
        <button
          onClick={handleCopiar}
          className={`w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            copied
              ? 'bg-success/20 text-success border border-success/30'
              : 'bg-gradient-to-r from-accent to-brand text-white'
          }`}
        >
          {copied
            ? <><Check size={16} /> ¡Copiado para WhatsApp!</>
            : <><ClipboardCopy size={16} /> Copiar Resumen ({totalSugeridos} productos)</>
          }
        </button>
      )}

      {error ? (
        <div className="text-center py-12">
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm mt-3">Reintentar</button>
        </div>
      ) : loading ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          {/* Productos que necesitan pedido */}
          {necesitanPedido.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-warning" />
                <p className="text-warning text-xs font-semibold uppercase tracking-wider">
                  Necesitan pedido ({necesitanPedido.length})
                </p>
              </div>
              {necesitanPedido.map((p) => (
                <div key={p.id} className="glass-card p-3 border border-warning/15">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                      <Package size={16} className="text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{p.nombre}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-white/30 text-xs">Stock: {p.stock_actual}</span>
                        <span className="text-white/30 text-xs">Vendidas 7d: {p.unidades7d}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-warning font-black text-xl leading-none">{p.sugerido}</p>
                      <p className="text-white/30 text-[10px]">sugeridas</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stock suficiente */}
          {stockSuficiente.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/30 text-xs font-medium uppercase tracking-wider">
                Stock suficiente ({stockSuficiente.length})
              </p>
              {stockSuficiente.map((p) => (
                <div key={p.id} className="glass-card p-3 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-success/8 flex items-center justify-center shrink-0">
                      <Package size={16} className="text-success/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-sm font-medium truncate">{p.nombre}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-white/25 text-xs">Stock: {p.stock_actual}</span>
                        <span className="text-white/25 text-xs">Vendidas 7d: {p.unidades7d}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-success/60 font-bold text-sm">✓ OK</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {productos.length === 0 && (
            <div className="text-center py-12">
              <Package size={36} className="text-white/15 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No hay productos en esta categoría</p>
            </div>
          )}

          {/* Nota metodología */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/3 border border-white/8">
            <BarChart2 size={12} className="text-white/25 shrink-0 mt-0.5" />
            <p className="text-white/25 text-xs leading-relaxed">
              Sugerido = promedio diario × 7 días − stock actual. Basado en ventas reales de los últimos 7 días sin contar ventas anuladas.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export function Analisis() {
  const [tab, setTab] = useState<'estadisticas' | 'pedidos'>('estadisticas')

  return (
    <div className="px-4 pb-36 pt-16 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-white">Análisis</h1>
        <p className="text-white/40 text-sm mt-0.5">Estadísticas y sugerencias de pedido</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/8">
        <button
          onClick={() => setTab('estadisticas')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
            tab === 'estadisticas' ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40'
          }`}
        >
          <BarChart2 size={12} /> Estadísticas
        </button>
        <button
          onClick={() => setTab('pedidos')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 ${
            tab === 'pedidos' ? 'bg-accent text-white' : 'text-white/40'
          }`}
        >
          <Package size={12} /> Pedidos
        </button>
      </div>

      {/* Contenido por tab */}
      {tab === 'estadisticas' ? <TabEstadisticas /> : <TabPedidos />}
    </div>
  )
}

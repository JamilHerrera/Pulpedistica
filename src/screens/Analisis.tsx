import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, ShoppingBag, BarChart2, RefreshCw, Calendar } from 'lucide-react'
import { useAnalisis } from '../hooks/useAnalisis'
import { SkeletonStats } from '../components/ui/SkeletonCard'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs border border-white/10">
      <p className="text-white/60">{label}</p>
      <p className="text-white font-bold">C$ {payload[0].value.toFixed(2)}</p>
    </div>
  )
}

export function Analisis() {
  const { data, loading, error, periodo, setPeriodo, refetch } = useAnalisis()

  const PERIODS: { value: 7 | 14 | 30; label: string }[] = [
    { value: 7, label: '7 días' },
    { value: 14, label: '14 días' },
    { value: 30, label: '30 días' },
  ]

  const semaphoreColors: Record<string, string> = {
    verde: '#10B981', amarillo: '#F59E0B', rojo: '#EF4444',
    azul: '#06B6D4', morado: '#7C3AED', gris: '#6B7280',
  }

  return (
    <div className="px-4 pb-36 pt-16 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Análisis</h1>
          <p className="text-white/40 text-sm mt-0.5">Estadísticas de ventas</p>
        </div>
        <button onClick={refetch} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center active:scale-90">
          <RefreshCw size={15} className="text-white/50" />
        </button>
      </div>

      {/* Selector de período */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              periodo === p.value ? 'bg-brand text-white shadow-glow-brand' : 'bg-white/5 text-white/50 border border-white/8'
            }`}
          >
            <Calendar size={11} />
            {p.label}
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
                C$ {data.totalSemana >= 1000
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
              <p className="text-base font-black text-white mt-1">
                C$ {data.promedioVenta.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Gráfico de barras */}
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
                  <XAxis
                    dataKey="dia"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                    {data.ventasDiarias.map((_, i) => (
                      <Cell
                        key={i}
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
                      <span className={`text-xs font-bold w-4 ${
                        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-white/50' : 'text-white/25'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white text-xs font-medium truncate">{p.nombre}</p>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-white/40 text-xs">{p.cantidad} uds</span>
                            <span className="text-success text-xs font-bold">C$ {p.subtotal.toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand to-accent rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Distribución por categoría */}
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
                          <span className="text-white text-xs font-bold">C$ {c.totalVentas.toFixed(0)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${c.porcentaje}%`, backgroundColor: color }}
                        />
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

import { useMemo } from 'react'
import {
  TrendingUp, AlertTriangle, ShoppingBag, Package,
  ChevronRight, Zap, RefreshCw,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { SkeletonStats, SkeletonList } from '../components/ui/SkeletonCard'
import type { Screen } from '../types'

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

interface Props {
  onNavigate: (s: Screen) => void
  onToast?: (t: string, m?: string, type?: 'success'|'error'|'warning'|'info') => void
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const today = new Date().getDay()
  return (
    <div className="flex items-end gap-1 h-12">
      {values.map((v, i) => {
        const dayIdx = (today - (6 - i) + 7) % 7
        const isToday = i === 6
        const height = Math.max(4, (v / max) * 48)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm transition-all duration-500 ${
                isToday ? 'bg-brand-light' : 'bg-white/15'
              }`}
              style={{ height: `${height}px` }}
            />
            <span className={`text-[9px] ${isToday ? 'text-brand-light' : 'text-white/30'}`}>
              {DAYS[dayIdx]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard({ onNavigate }: Props) {
  const { stats, loading, error, refetch } = useDashboard()

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return '¡Buenos días!'
    if (h < 18) return '¡Buenas tardes!'
    return '¡Buenas noches!'
  }, [])

  const today = useMemo(() =>
    new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' }),
  [])

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 px-6">
      <AlertTriangle size={40} className="text-warning" />
      <p className="text-white/60 text-center text-sm">{error}</p>
      <button onClick={refetch} className="btn-ghost flex items-center gap-2">
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  )

  return (
    <div className="px-4 pb-36 pt-16 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <p className="text-white/40 text-sm font-medium capitalize">{today}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">{greeting}</h1>
          <p className="text-brand-light text-sm font-medium mt-0.5">PulpeAnálisis ✦</p>
        </div>
        <button
          onClick={refetch}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center active:scale-90 transition-all"
        >
          <RefreshCw size={16} className="text-white/50" />
        </button>
      </div>

      {loading ? (
        <>
          <div className="skeleton h-40 w-full rounded-3xl" />
          <SkeletonStats />
          <SkeletonList rows={3} />
        </>
      ) : stats ? (
        <>
          {/* Revenue hero card */}
          <div
            className="relative rounded-3xl overflow-hidden p-5"
            style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 40%, #0c1445 100%)' }}
          >
            <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(124,58,237,0.4) 0%, transparent 60%)' }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-yellow-400" />
                <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Ventas hoy</p>
              </div>
              <p className="text-4xl font-black text-white tracking-tight">
                L {stats.montoHoy.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-white/50 text-sm mt-1">{stats.ventasHoy} transacciones</p>
              <div className="mt-4">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2">Últimos 7 días</p>
                <MiniBarChart values={stats.ventasEsta_semana} />
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Stock bajo"
              value={stats.productosStockBajo}
              icon={AlertTriangle}
              color={stats.productosStockBajo > 0 ? 'danger' : 'success'}
              suffix="productos"
              onClick={() => onNavigate('inventario')}
            />
            <StatCard
              label="Inventario"
              value={stats.totalProductos}
              icon={Package}
              color="accent"
              suffix="productos"
              onClick={() => onNavigate('inventario')}
            />
          </div>

          {/* Alertas de stock bajo */}
          {stats.productosStockBajo > 0 && (
            <div className="glass-card p-4 border-danger/20" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-danger rounded-full animate-pulse" />
                <p className="text-danger text-xs font-semibold uppercase tracking-wider">Alerta de Stock</p>
              </div>
              <p className="text-white/70 text-sm">
                <span className="text-white font-bold">{stats.productosStockBajo}</span> producto{stats.productosStockBajo !== 1 ? 's' : ''} con stock crítico. Revisa el inventario.
              </p>
              <button
                onClick={() => onNavigate('inventario')}
                className="mt-3 flex items-center gap-1 text-danger text-xs font-semibold"
              >
                Ver inventario <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Top productos */}
          {stats.topProductos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-semibold text-sm">Top productos (7 días)</p>
                <button onClick={() => onNavigate('analisis')} className="text-brand-light text-xs flex items-center gap-0.5">
                  Ver más <ChevronRight size={12} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {stats.topProductos.slice(0, 4).map((p, i) => (
                  <div key={p.nombre} className="glass-card px-4 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      i === 1 ? 'bg-white/10 text-white/60' :
                      'bg-white/5 text-white/40'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{p.nombre}</p>
                    </div>
                    <div className="flex items-center gap-1 text-brand-light">
                      <ShoppingBag size={12} />
                      <span className="text-xs font-bold">{p.cantidad}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ventas recientes */}
          {stats.ventasRecientes.length > 0 && (
            <div>
              <p className="text-white font-semibold text-sm mb-3">Ventas recientes</p>
              <div className="flex flex-col gap-2">
                {stats.ventasRecientes.map((v) => (
                  <div key={v.id} className="glass-card px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                      <ShoppingBag size={16} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">Venta registrada</p>
                      <p className="text-white/40 text-xs">
                        {new Date(v.fecha_hora).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="text-success font-bold text-sm">
                      L {(v.monto_total ?? 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.ventasRecientes.length === 0 && stats.topProductos.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp size={36} className="text-white/15 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Sin actividad aún hoy.</p>
              <button onClick={() => onNavigate('venta')} className="mt-4 btn-primary text-sm py-2.5 px-5">
                Registrar primera venta
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  label, value, icon: Icon, color, suffix, onClick,
}: {
  label: string; value: number; icon: typeof TrendingUp
  color: 'danger' | 'success' | 'accent' | 'brand'; suffix?: string; onClick?: () => void
}) {
  const colorMap = {
    danger:  { bg: 'bg-danger/10',  text: 'text-danger',  border: 'border-danger/20'  },
    success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
    accent:  { bg: 'bg-accent/10',  text: 'text-accent',  border: 'border-accent/20'  },
    brand:   { bg: 'bg-brand/10',   text: 'text-brand-light', border: 'border-brand/20' },
  }
  const c = colorMap[color]
  return (
    <button onClick={onClick} className={`glass-card p-4 text-left active:scale-95 transition-all duration-150 border ${c.border}`}>
      <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={c.text} />
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-value text-white mt-1">{value}</p>
      {suffix && <p className="text-white/30 text-[11px] mt-0.5">{suffix}</p>}
    </button>
  )
}

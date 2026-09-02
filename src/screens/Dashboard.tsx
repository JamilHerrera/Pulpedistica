import { useMemo, useState } from 'react'
import {
  TrendingUp, AlertTriangle, ShoppingBag, Package,
  ChevronRight, Zap, RefreshCw, Ban, X, Clock, Flame,
} from 'lucide-react'
import { useDashboard } from '../hooks/useDashboard'
import { useEstancados } from '../hooks/useEstancados'
import { SkeletonStats, SkeletonList } from '../components/ui/SkeletonCard'
import type { Screen, Venta } from '../types'
import type { ProductoEstancado } from '../hooks/useEstancados'

const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

interface Props {
  onNavigate: (s: Screen) => void
  onToast?: (t: string, m?: string, type?: 'success'|'error'|'warning'|'info') => void
}

// ─── Modal de productos estancados ────────────────────────────────────────────

function EstancadosModal({
  estancados, onClose,
}: { estancados: ProductoEstancado[]; onClose: () => void }) {
  const formatDias = (d: number) =>
    d >= 999 ? 'Nunca vendido' : `${d} día${d !== 1 ? 's' : ''} sin venta`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-2xl glass-card rounded-t-3xl sm:rounded-3xl pb-8 sm:pb-6 animate-slide-up border-t-2 sm:border-t border-orange-500/40 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Flame size={15} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Riesgo de estancamiento</h2>
              <p className="text-white/35 text-xs">{estancados.length} productos sin ventas 30+ días</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 active:scale-90 transition-all"><X size={20} /></button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {estancados.map((p) => {
            const critico = p.diasSinVenta >= 30 || p.diasSinVenta >= 999
            const color   = p.diasSinVenta >= 999 ? 'text-danger' : critico ? 'text-orange-400' : 'text-warning'
            return (
              <div key={p.id} className="glass-card p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  p.diasSinVenta >= 999 ? 'bg-danger/10' : 'bg-orange-500/10'
                }`}>
                  <Clock size={15} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{p.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.categorias && (
                      <span className="text-white/30 text-[10px]">{p.categorias.nombre}</span>
                    )}
                    <span className="text-white/20 text-[10px]">•</span>
                    <span className="text-white/30 text-[10px]">{p.stock_actual} en stock</span>
                  </div>
                  <p className={`text-xs font-bold mt-1 ${color}`}>
                    ⏱ {formatDias(p.diasSinVenta)}
                  </p>
                  {p.ultimaVenta && (
                    <p className="text-white/25 text-[10px]">
                      Última venta: {p.ultimaVenta.toLocaleDateString('es-HN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-black text-xl leading-none ${color}`}>
                    {p.diasSinVenta >= 999 ? '∞' : p.diasSinVenta}
                  </p>
                  <p className="text-white/25 text-[9px]">días</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pie */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/8 border border-orange-500/15 mb-3">
            <AlertTriangle size={12} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-orange-300/70 text-xs leading-relaxed">
              Considera ofertas o liquidación para liberar espacio y recuperar capital.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-white/8 text-white/60 font-semibold text-sm active:scale-95 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de detalle de venta ────────────────────────────────────────────────

function VentaDetalleModal({ venta, onClose }: { venta: Venta; onClose: () => void }) {
  const detalles = venta.detalle_ventas ?? []
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg glass-card rounded-t-3xl sm:rounded-3xl pb-8 sm:pb-6 animate-slide-up border-t-2 sm:border-t border-accent/40 max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
              <ShoppingBag size={16} className="text-accent" />
            </div>
            <div>
              <p className="text-white/40 text-xs">
                {new Date(venta.fecha_hora).toLocaleString('es-HN', {
                  weekday: 'short', day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <p className="text-white font-black text-xl leading-tight">
                L {(venta.monto_total ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Lista de productos */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {detalles.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag size={28} className="text-white/15 mx-auto mb-2" />
              <p className="text-white/35 text-sm">Venta de monto libre</p>
              <p className="text-white/25 text-xs mt-1">Sin productos registrados en el catálogo</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-white/35 text-xs uppercase tracking-wider mb-3">
                {detalles.length} producto{detalles.length !== 1 ? 's' : ''} vendido{detalles.length !== 1 ? 's' : ''}
              </p>
              {detalles.map((d, i) => {
                  const nombre    = (d as any).productos?.nombre ?? 'Producto'
                  const cantidad  = d.cantidad ?? 0
                  const subtotal  = d.subtotal ?? 0
                  const precio    = cantidad > 0 ? subtotal / cantidad : 0
                  return (
                    <div key={d.id ?? i} className="py-2.5 border-b border-white/[0.05] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          <span className="text-white/40 text-xs font-bold">{cantidad}</span>
                        </div>
                        <p className="flex-1 text-white/80 text-sm font-medium truncate">{nombre}</p>
                        <p className="text-success text-sm font-bold shrink-0">
                          L {subtotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-10 mt-0.5">
                        <span className="text-white/25 text-xs">{cantidad} × L {precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )
              })}
            </div>
          )}
        </div>

        {/* Pie con total */}
        {detalles.length > 0 && (
          <div className="px-5 pt-3 border-t border-white/8 shrink-0">
            <div className="flex items-center justify-between py-2">
              <p className="text-white/50 text-sm font-medium">Total</p>
              <p className="text-white font-black text-lg">
                L {(venta.monto_total ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal de confirmación de anulación ───────────────────────────────────────
function AnularModal({
  venta, onConfirm, onClose, loading,
}: { venta: Venta; onConfirm: () => void; onClose: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up border-t-2 sm:border-t border-danger/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-danger/20 flex items-center justify-center">
              <Ban size={16} className="text-danger" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Anular venta</h2>
              <p className="text-white/35 text-xs">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30"><X size={20} /></button>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
          <p className="text-white/40 text-xs uppercase tracking-wider">Venta a anular</p>
          <p className="text-white font-black text-2xl">
            L {(venta.monto_total ?? 0).toFixed(2)}
          </p>
          <p className="text-white/40 text-xs">
            {new Date(venta.fecha_hora).toLocaleString('es-HN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
          <AlertTriangle size={13} className="text-warning shrink-0 mt-0.5" />
          <p className="text-warning/80 text-xs leading-relaxed">
            Se marcará como <strong>Anulada</strong> en la base de datos y el stock de los productos involucrados se restaurará automáticamente.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white/8 text-white/60 font-semibold text-sm active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${
              loading ? 'bg-danger/30 text-danger/40' : 'bg-danger text-white'
            }`}
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Ban size={14} /> Confirmar anulación</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const today = new Date().getDay()
  return (
    <div className="flex items-end gap-1.5 h-12 lg:h-36">
      {values.map((v, i) => {
        const dayIdx = (today - (6 - i) + 7) % 7
        const isToday = i === 6
        return (
          <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-sm transition-all duration-500 ${
                isToday ? 'bg-brand-light' : 'bg-white/15'
              }`}
              style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
            />
            <span className={`shrink-0 text-[9px] ${isToday ? 'text-brand-light' : 'text-white/30'}`}>
              {DAYS[dayIdx]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard({ onNavigate, onToast }: Props) {
  const { stats, loading, error, refetch, anularVenta } = useDashboard()
  const { estancados } = useEstancados()
  const [ventaParaAnular,  setVentaParaAnular]  = useState<Venta | null>(null)
  const [ventaDetalle,     setVentaDetalle]     = useState<Venta | null>(null)
  const [anulando,         setAnulando]         = useState(false)
  const [showEstancados,   setShowEstancados]   = useState(false)

  const handleAnular = async () => {
    if (!ventaParaAnular) return
    setAnulando(true)
    const ok = await anularVenta(ventaParaAnular.id)
    setAnulando(false)
    setVentaParaAnular(null)
    if (ok) onToast?.('Venta anulada', `L ${ventaParaAnular.monto_total.toFixed(2)} revertido`, 'success')
    else onToast?.('Error al anular', 'Revisa tu conexión', 'error')
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return '¡Buenos días!'
    if (h < 18) return '¡Buenas tardes!'
    return '¡Buenas noches!'
  }, [])

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">{greeting}</h2>
        <button
          onClick={refetch}
          title="Actualizar datos"
          className="w-10 h-10 shrink-0 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
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
          {/* Fila principal: ingresos + métricas */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue hero card */}
            <div
              className="relative rounded-3xl overflow-hidden p-5 lg:col-span-2 lg:p-6"
              style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 40%, #0c1445 100%)' }}
            >
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 80% 20%, rgba(124,58,237,0.4) 0%, transparent 60%)' }} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-yellow-400" />
                  <p className="text-white/60 text-xs font-medium uppercase tracking-widest">Ventas hoy</p>
                </div>
                <p className="text-4xl lg:text-5xl font-black text-white tracking-tight">
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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
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
          </div>

          {/* Alertas */}
          <div className="grid gap-4 md:grid-cols-2">
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

          {/* Banner de productos estancados (US8) */}
          {estancados.length > 0 && (
            <button
              onClick={() => setShowEstancados(true)}
              className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all text-left"
              style={{ borderColor: 'rgba(249,115,22,0.25)', border: '1px solid rgba(249,115,22,0.25)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame size={18} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                  <p className="text-orange-400 text-xs font-bold uppercase tracking-wider">Riesgo de Estancamiento</p>
                </div>
                <p className="text-white/70 text-sm mt-0.5">
                  <span className="text-white font-bold">{estancados.length}</span> producto{estancados.length !== 1 ? 's' : ''} sin ventas en 30+ días
                </p>
                <p className="text-white/35 text-xs mt-0.5">Toca para ver la lista detallada →</p>
              </div>
              <ChevronRight size={16} className="text-white/30 shrink-0" />
            </button>
          )}
          </div>

          {/* Listas */}
          <div className="grid gap-5 lg:grid-cols-2 items-start">
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
                {stats.ventasRecientes.map((v, i) => {
                  const esAnulada = v.anulada === true
                  const esMasReciente = i === 0 && !esAnulada
                  return (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setVentaDetalle(v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setVentaDetalle(v)
                      }}
                      className={`w-full glass-card px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.98] text-left cursor-pointer ${
                        esAnulada ? 'opacity-50' : ''
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        esAnulada ? 'bg-danger/10' : 'bg-accent/10'
                      }`}>
                        {esAnulada
                          ? <Ban size={16} className="text-danger" />
                          : <ShoppingBag size={16} className="text-accent" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${esAnulada ? 'text-white/40 line-through' : 'text-white'}`}>
                            Venta registrada
                          </p>
                          {esAnulada && (
                            <span className="text-[9px] font-bold text-danger bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded-full">
                              ANULADA
                            </span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs">
                          {new Date(v.fecha_hora).toLocaleString('es-HN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className={`font-bold text-sm ${esAnulada ? 'text-white/25 line-through' : 'text-success'}`}>
                          L {(v.monto_total ?? 0).toFixed(2)}
                        </p>
                        {esMasReciente && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setVentaParaAnular(v)
                            }}
                            className="w-7 h-7 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center active:scale-90 transition-all"
                            title="Anular esta venta"
                          >
                            <Ban size={13} className="text-danger" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </div>

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

      {/* Modal de anulación */}
      {ventaParaAnular && (
        <AnularModal
          venta={ventaParaAnular}
          onConfirm={handleAnular}
          onClose={() => setVentaParaAnular(null)}
          loading={anulando}
        />
      )}

      {/* Modal de detalle de venta */}
      {ventaDetalle && (
        <VentaDetalleModal
          venta={ventaDetalle}
          onClose={() => setVentaDetalle(null)}
        />
      )}

      {/* Modal de productos estancados (US8) */}
      {showEstancados && (
        <EstancadosModal
          estancados={estancados}
          onClose={() => setShowEstancados(false)}
        />
      )}
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

import { useState } from 'react'
import { RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useSemaforo } from '../hooks/useSemaforo'
import type { CategoriaConProductos } from '../hooks/useSemaforo'
import type { Producto } from '../types'
import { SkeletonList } from '../components/ui/SkeletonCard'

const COLOR_MAP: Record<string, { bg: string; ring: string; dot: string; label: string; bar: string }> = {
  verde:    { bg: 'bg-success/10',  ring: 'border-success/30',  dot: 'bg-success',  label: 'text-success',  bar: 'bg-success' },
  amarillo: { bg: 'bg-warning/10',  ring: 'border-warning/30',  dot: 'bg-warning',  label: 'text-warning',  bar: 'bg-warning' },
  rojo:     { bg: 'bg-danger/10',   ring: 'border-danger/30',   dot: 'bg-danger',   label: 'text-danger',   bar: 'bg-danger'  },
  azul:     { bg: 'bg-accent/10',   ring: 'border-accent/30',   dot: 'bg-accent',   label: 'text-accent',   bar: 'bg-accent'  },
  morado:   { bg: 'bg-brand/10',    ring: 'border-brand/30',    dot: 'bg-brand',    label: 'text-brand-light', bar: 'bg-brand' },
  gris:     { bg: 'bg-white/5',     ring: 'border-white/10',    dot: 'bg-white/40', label: 'text-white/50', bar: 'bg-white/30' },
}

function getColor(color_semaforo: string) {
  const key = color_semaforo?.toLowerCase().trim() ?? 'gris'
  return COLOR_MAP[key] ?? COLOR_MAP.gris
}

function StockBar({ stock }: { stock: number }) {
  const max = 50
  const pct = Math.min(100, (stock / max) * 100)
  const color = stock === 0 ? 'bg-danger' : stock <= 5 ? 'bg-warning' : stock <= 15 ? 'bg-yellow-400' : 'bg-success'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${
        stock === 0 ? 'text-danger' : stock <= 5 ? 'text-warning' : 'text-white/60'
      }`}>{stock}</span>
    </div>
  )
}

function ProductRow({ producto }: { producto: Producto }) {
  const isCritical = producto.stock_actual === 0
  const isLow = producto.stock_actual > 0 && producto.stock_actual <= 5
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0 ${isCritical ? 'opacity-70' : ''}`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${
        isCritical ? 'bg-danger animate-pulse' : isLow ? 'bg-warning animate-pulse' : 'bg-white/15'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{producto.nombre}</p>
        <StockBar stock={producto.stock_actual} />
      </div>
      {isCritical && (
        <span className="text-[10px] font-bold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full shrink-0">
          AGOTADO
        </span>
      )}
      {isLow && !isCritical && (
        <span className="text-[10px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full shrink-0">
          BAJO
        </span>
      )}
    </div>
  )
}

function CategoriaCard({ cat, defaultOpen = true }: { cat: CategoriaConProductos; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const c = getColor(cat.color_semaforo)
  const label = (cat.color_semaforo ?? '').toLowerCase()
  const labelMap: Record<string, string> = {
    verde: 'Alta rotación', amarillo: 'Rotación media', rojo: 'Baja rotación / Riesgo',
    azul: 'Especiales', morado: 'Premium', gris: 'Sin clasificar',
  }

  return (
    <div className={`glass-card overflow-hidden border ${c.ring} animate-slide-up`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/3"
      >
        {/* Semaphore dot */}
        <div className="relative">
          <div className={`w-4 h-4 rounded-full ${c.dot} shadow-lg`} />
          <div className={`absolute inset-0 rounded-full ${c.dot} opacity-40 animate-ping`} />
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-white font-semibold text-sm truncate">{cat.nombre}</p>
          <p className={`text-xs font-medium ${c.label}`}>{labelMap[label] ?? label}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-white font-bold text-sm">{cat.productos.length}</p>
            <p className="text-white/30 text-[10px]">productos</p>
          </div>
          {cat.stockBajo > 0 && (
            <div className="bg-danger/15 text-danger text-[10px] font-bold px-2 py-0.5 rounded-full border border-danger/20">
              {cat.stockBajo} bajo
            </div>
          )}
          {open ? <ChevronUp size={16} className="text-white/30 shrink-0" /> : <ChevronDown size={16} className="text-white/30 shrink-0" />}
        </div>
      </button>

      {open && (
        <div className={`px-4 pb-3 ${c.bg} border-t border-white/[0.04]`}>
          {cat.productos.map((p) => <ProductRow key={p.id} producto={p} />)}
        </div>
      )}
    </div>
  )
}

type FilterColor = 'todos' | 'verde' | 'amarillo' | 'rojo'

export function Semaforo() {
  const { categorias, loading, error, lastUpdate, refetch } = useSemaforo()
  const [filter, setFilter] = useState<FilterColor>('todos')

  const filtered = filter === 'todos'
    ? categorias
    : categorias.filter((c) => c.color_semaforo?.toLowerCase() === filter)

  const totalBajos = categorias.reduce((s, c) => s + c.stockBajo, 0)

  return (
    <div className="px-4 pb-36 pt-16 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Semáforo</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <p className="text-white/40 text-xs">
              Actualizado {lastUpdate.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalBajos > 0 && (
            <div className="bg-danger/15 text-danger text-xs font-bold px-3 py-1.5 rounded-xl border border-danger/20">
              {totalBajos} alertas
            </div>
          )}
          <button onClick={refetch} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center active:scale-90 transition-all">
            <RefreshCw size={15} className="text-white/50" />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        {(['todos','verde','amarillo','rojo'] as FilterColor[]).map((f) => {
          const labels: Record<FilterColor, string> = { todos: 'Todos', verde: '🟢 Alta', amarillo: '🟡 Media', rojo: '🔴 Riesgo' }
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                filter === f ? 'bg-brand text-white' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {labels[f]}
            </button>
          )
        })}
      </div>

      {/* Leyenda */}
      <div className="glass-card p-3 flex gap-4 justify-center">
        {[
          { color: 'bg-success', label: 'Alta rotación' },
          { color: 'bg-warning', label: 'Rotación media' },
          { color: 'bg-danger',  label: 'Riesgo / Baja' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
            <span className="text-white/50 text-[11px]">{l.label}</span>
          </div>
        ))}
      </div>

      {error ? (
        <div className="text-center py-12 space-y-3">
          <WifiOff size={36} className="text-white/20 mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm">Reintentar</button>
        </div>
      ) : loading ? (
        <SkeletonList rows={5} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No hay categorías con ese filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cat, i) => (
            <CategoriaCard key={cat.id} cat={cat} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {/* Indicador tiempo real */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Wifi size={12} className="text-white/20" />
        <span className="text-white/20 text-[11px]">Actualización en tiempo real activa</span>
      </div>
    </div>
  )
}

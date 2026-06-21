import { useState } from 'react'
import { RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react'
import { useSemaforo } from '../hooks/useSemaforo'
import type { GrupoRotacion, NivelRotacion, ProductoConRotacion } from '../hooks/useSemaforo'

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-12 h-12 border-2 border-white/10 border-t-brand rounded-full animate-spin" />
      <p className="text-white/30 text-sm">Recalculando rotación…</p>
    </div>
  )
}

// ─── Configuración visual por nivel ───────────────────────────────────────────

const NIVEL_CONFIG: Record<NivelRotacion, {
  label: string
  sublabel: string
  emoji: string
  dot: string
  bg: string
  ring: string
  textColor: string
  bar: string
  Icon: React.ElementType
}> = {
  alta: {
    label:    'Alta rotación',
    sublabel: 'Se venden bien — reabastecer frecuente',
    emoji:    '🟢',
    dot:      'bg-success',
    bg:       'bg-success/10',
    ring:     'border-success/30',
    textColor:'text-success',
    bar:      'bg-success',
    Icon:     TrendingUp,
  },
  media: {
    label:    'Rotación media',
    sublabel: 'Ventas moderadas — seguimiento normal',
    emoji:    '🟡',
    dot:      'bg-warning',
    bg:       'bg-warning/10',
    ring:     'border-warning/30',
    textColor:'text-warning',
    bar:      'bg-warning',
    Icon:     Minus,
  },
  baja: {
    label:    'Baja rotación',
    sublabel: 'Pocas ventas — evitar sobrestock',
    emoji:    '🔴',
    dot:      'bg-danger',
    bg:       'bg-danger/10',
    ring:     'border-danger/30',
    textColor:'text-danger',
    bar:      'bg-danger',
    Icon:     TrendingDown,
  },
}

// ─── Fila de producto ──────────────────────────────────────────────────────────

function ProductRow({
  producto, periodo, bar,
}: { producto: ProductoConRotacion; periodo: 7 | 15 | 30; bar: string }) {
  const unidades  = periodo === 7 ? producto.unidades7d : periodo === 15 ? producto.unidades15d : producto.unidades30d
  const stockMax  = Math.max(30, producto.stock_actual)
  const stockPct  = Math.min(100, (producto.stock_actual / stockMax) * 100)
  const stockColor = producto.stock_actual === 0
    ? 'bg-danger' : producto.stock_actual <= 5
    ? 'bg-warning' : 'bg-white/25'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm font-medium truncate">{producto.nombre}</p>
          {unidades === 0 && (
            <span className="text-[9px] font-bold text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-full shrink-0">
              SIN VENTAS
            </span>
          )}
          {producto.stock_actual === 0 && (
            <span className="text-[9px] font-bold text-danger bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded-full shrink-0">
              AGOTADO
            </span>
          )}
        </div>
        {producto.categorias && (
          <p className="text-white/30 text-xs truncate">{producto.categorias.nombre}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${stockColor}`}
              style={{ width: `${stockPct}%` }} />
          </div>
          <span className="text-white/40 text-[10px] w-14 text-right shrink-0">
            {producto.stock_actual} en stock
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={`font-black text-lg leading-none ${unidades > 0 ? 'text-white' : 'text-white/20'}`}>
          {unidades}
        </p>
        <p className="text-white/25 text-[10px]">vendidas</p>
      </div>
    </div>
  )
}

// ─── Card de grupo ─────────────────────────────────────────────────────────────

function GrupoCard({
  grupo, periodo, defaultOpen,
}: { grupo: GrupoRotacion; periodo: 7 | 15 | 30; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = NIVEL_CONFIG[grupo.nivel]
  const { Icon } = cfg
  const empty = grupo.productos.length === 0

  return (
    <div className={`glass-card overflow-hidden border ${cfg.ring} animate-slide-up ${empty ? 'opacity-50' : ''}`}>
      <button
        onClick={() => !empty && setOpen(!open)}
        className="w-full px-4 py-3.5 flex items-center gap-3 active:bg-white/3"
      >
        {/* Semaphore dot animado */}
        <div className="relative shrink-0">
          <div className={`w-4 h-4 rounded-full ${cfg.dot}`} />
          {!empty && (
            <div className={`absolute inset-0 rounded-full ${cfg.dot} opacity-30 animate-ping`} />
          )}
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-white font-semibold text-sm">{cfg.label}</p>
          <p className={`text-xs ${cfg.textColor}`}>{cfg.sublabel}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`font-black text-base leading-none ${cfg.textColor}`}>
              {grupo.productos.length}
            </p>
            <p className="text-white/25 text-[10px]">productos</p>
          </div>
          {grupo.totalUnidades > 0 && (
            <div className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${cfg.bg} ${cfg.textColor} border ${cfg.ring}`}>
              {grupo.totalUnidades} uds
            </div>
          )}
          {!empty && (
            open
              ? <ChevronUp size={15} className="text-white/30" />
              : <ChevronDown size={15} className="text-white/30" />
          )}
          {empty && <Icon size={15} className="text-white/20" />}
        </div>
      </button>

      {open && !empty && (
        <div className={`px-4 pb-3 ${cfg.bg} border-t border-white/[0.04]`}>
          {grupo.productos.map((p) => (
            <ProductRow key={p.id} producto={p} periodo={periodo} bar={cfg.bar} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pantalla principal ────────────────────────────────────────────────────────

export function Semaforo() {
  const { grupos, totales, loading, error, lastUpdate, periodo, setPeriodo, refetch } = useSemaforo()

  const UMBRALES_LABEL = {
    7:  { alta: '≥ 7 uds',  media: '3–6 uds',   baja: '1–2 uds' },
    15: { alta: '≥ 12 uds', media: '5–11 uds',  baja: '1–4 uds' },
    30: { alta: '≥ 20 uds', media: '7–19 uds',  baja: '1–6 uds' },
  }

  const resumen = grupos.reduce<Record<NivelRotacion, number>>(
    (acc, g) => { acc[g.nivel] = g.productos.length; return acc },
    { alta: 0, media: 0, baja: 0 },
  )

  return (
    <div className="px-4 pb-36 pt-16 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Semáforo</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <p className="text-white/40 text-xs">
              {lastUpdate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center active:scale-90 transition-all"
        >
          <RefreshCw size={15} className="text-white/50" />
        </button>
      </div>

      {/* Toggle 7d / 15d / 30d */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/8">
        {([7, 15, 30] as const).map((d) => (
          <button
            key={d}
            onClick={() => setPeriodo(d)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
              periodo === d
                ? 'bg-brand text-white shadow-glow-brand'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {d} días
          </button>
        ))}
      </div>

      {/* Resumen rápido */}
      {!loading && !error && (
        <div className="glass-card p-3 grid grid-cols-4 gap-2">
          {(Object.entries(resumen) as [NivelRotacion, number][]).map(([nivel, count]) => {
            const cfg = NIVEL_CONFIG[nivel]
            return (
              <div key={nivel} className="text-center">
                <p className={`text-xl font-black ${cfg.textColor}`}>{count}</p>
                <p className="text-white/30 text-[10px] leading-tight mt-0.5">{cfg.emoji}</p>
              </div>
            )
          })}
          <div className="text-center">
            <p className="text-xl font-black text-white/30">{totales.sinMovimiento}</p>
            <p className="text-white/30 text-[10px] leading-tight mt-0.5">⚫</p>
          </div>
        </div>
      )}

      {/* Stats de ventas */}
      {!loading && !error && totales.productos > 0 && (
        <div className="glass-card p-3 flex justify-between items-center">
          <div className="text-center flex-1">
            <p className="text-white font-black text-lg">
              {periodo === 7 ? totales.vendidos7d : periodo === 15 ? totales.vendidos15d : totales.vendidos30d}
            </p>
            <p className="text-white/35 text-[11px]">uds vendidas ({periodo}d)</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-white font-black text-lg">{totales.productos}</p>
            <p className="text-white/35 text-[11px]">productos totales</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center flex-1">
            <p className="text-success font-black text-lg">{resumen.alta}</p>
            <p className="text-white/35 text-[11px]">alta rotación</p>
          </div>
        </div>
      )}

      {/* Leyenda de umbrales */}
      <div className="flex gap-2 flex-wrap">
        {(['alta', 'media', 'baja'] as NivelRotacion[]).map((nivel) => {
          const cfg = NIVEL_CONFIG[nivel]
          const threshold = UMBRALES_LABEL[periodo as 7 | 15 | 30][nivel as 'alta' | 'media' | 'baja']
          return (
            <div key={nivel} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${cfg.bg} border ${cfg.ring}`}>
              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-[11px] font-medium ${cfg.textColor}`}>{threshold}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-warning/8 border border-warning/15">
          <span className="text-[11px] font-medium text-warning/60">⚠️ 0 uds = badge SIN VENTAS</span>
        </div>
      </div>

      {/* Contenido principal */}
      {error ? (
        <div className="text-center py-12 space-y-3">
          <WifiOff size={36} className="text-white/20 mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
          <button onClick={refetch} className="btn-ghost text-sm">Reintentar</button>
        </div>
      ) : loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo, i) => (
            <GrupoCard
              key={grupo.nivel}
              grupo={grupo}
              periodo={periodo}
              defaultOpen={i === 0 && grupo.productos.length > 0}
            />
          ))}
        </div>
      )}

      {/* Indicador en tiempo real */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Wifi size={12} className="text-white/20" />
        <span className="text-white/20 text-[11px]">Clasificación automática por ventas reales</span>
      </div>
    </div>
  )
}

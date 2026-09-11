import { useMemo, useState } from 'react'
import {
  MessageSquare, Star, Check, RotateCcw, AlertTriangle, Lightbulb, Bug, Heart, Circle,
} from 'lucide-react'
import { useFeedback } from '../hooks/useFeedback'
import { SkeletonList } from '../components/ui/SkeletonCard'
import type { Feedback, TipoFeedback } from '../types'

type Filtro = 'pendientes' | 'atendidos' | 'todos'

interface Props {
  onToast: (t: string, m?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const ESTILO_TIPO: Record<TipoFeedback, { etiqueta: string; icono: typeof Bug; color: string; fondo: string }> = {
  sugerencia: { etiqueta: 'Sugerencia', icono: Lightbulb, color: 'text-brand-light', fondo: 'bg-brand/10'   },
  problema:   { etiqueta: 'Problema',   icono: Bug,       color: 'text-danger',      fondo: 'bg-danger/10'  },
  elogio:     { etiqueta: 'Me gustó',   icono: Heart,     color: 'text-success',     fondo: 'bg-success/10' },
  otro:       { etiqueta: 'Otro',       icono: Circle,    color: 'text-white/50',    fondo: 'bg-white/5'    },
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-HN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

function Estrellas({ valor }: Readonly<{ valor: number }>) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= valor ? 'text-warning fill-warning' : 'text-white/15'}
        />
      ))}
    </span>
  )
}

function ComentarioCard({
  comentario, esSoporte, onToggle,
}: Readonly<{
  comentario: Feedback
  esSoporte: boolean
  onToggle: (c: Feedback) => void
}>) {
  const estilo = ESTILO_TIPO[comentario.tipo] ?? ESTILO_TIPO.otro
  const Icono = estilo.icono

  return (
    <div className={`glass-card p-4 space-y-3 ${comentario.atendido ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${estilo.fondo} flex items-center justify-center shrink-0`}>
          <Icono size={16} className={estilo.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${estilo.color}`}>{estilo.etiqueta}</span>
            {comentario.calificacion !== null && <Estrellas valor={comentario.calificacion} />}
            {comentario.atendido && (
              <span className="text-[9px] font-bold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full">
                ATENDIDO
              </span>
            )}
          </div>
          <p className="text-white/35 text-[11px] mt-0.5">
            {fechaHora(comentario.created_at)}
            {comentario.pantalla && ` · desde ${comentario.pantalla}`}
          </p>
        </div>

        {esSoporte && (
          <button
            onClick={() => onToggle(comentario)}
            title={comentario.atendido ? 'Marcar como pendiente' : 'Marcar como atendido'}
            className={`w-8 h-8 shrink-0 rounded-xl border flex items-center justify-center active:scale-90 transition-all ${
              comentario.atendido
                ? 'bg-white/5 border-white/10 text-white/40'
                : 'bg-success/10 border-success/25 text-success'
            }`}
          >
            {comentario.atendido ? <RotateCcw size={14} /> : <Check size={15} strokeWidth={2.5} />}
          </button>
        )}
      </div>

      <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {comentario.mensaje}
      </p>
    </div>
  )
}

export function Comentarios({ onToast }: Readonly<Props>) {
  const {
    comentarios, esSoporte, loading, error,
    pendientes, promedio, totalConNota, marcarAtendido,
  } = useFeedback()

  const [filtro, setFiltro] = useState<Filtro>('pendientes')

  const visibles = useMemo(() => {
    if (filtro === 'pendientes') return comentarios.filter((c) => !c.atendido)
    if (filtro === 'atendidos') return comentarios.filter((c) => c.atendido)
    return comentarios
  }, [comentarios, filtro])

  const handleToggle = async (c: Feedback) => {
    const ok = await marcarAtendido(c.id, !c.atendido)
    if (!ok) return onToast('No se pudo actualizar', 'Revisá tu conexión', 'error')
    onToast(c.atendido ? 'Marcado como pendiente' : 'Marcado como atendido', undefined, 'success')
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Comentarios</h2>
        <p className="text-white/40 text-sm mt-0.5">
          {esSoporte
            ? 'Lo que opinan quienes usan la app'
            : 'Los comentarios que enviaste'}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="stat-label">Total</p>
          <p className="stat-value text-white mt-1">{comentarios.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Sin atender</p>
          <p className={`stat-value mt-1 ${pendientes > 0 ? 'text-warning' : 'text-success'}`}>
            {pendientes}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Puntaje medio</p>
          <p className="stat-value text-white mt-1">
            {promedio !== null ? promedio.toFixed(1) : '—'}
          </p>
          <p className="text-white/30 text-[11px] mt-0.5">
            {totalConNota > 0 ? `de ${totalConNota} con nota` : 'sin puntajes aún'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/8 max-w-md">
        {([
          ['pendientes', 'Sin atender'],
          ['atendidos', 'Atendidos'],
          ['todos', 'Todos'],
        ] as [Filtro, string][]).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              filtro === id ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {error ? (
        <div className="text-center py-12 space-y-3">
          <AlertTriangle size={32} className="text-warning mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <SkeletonList rows={3} />
      ) : visibles.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            {filtro === 'pendientes' ? 'No hay comentarios sin atender.'
              : filtro === 'atendidos' ? 'Todavía no marcaste ninguno como atendido.'
              : 'Aún no hay comentarios.'}
          </p>
          {!esSoporte && filtro === 'todos' && (
            <p className="text-white/25 text-xs mt-2">
              Usá el botón de comentarios en la barra superior para enviar el primero.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          {visibles.map((c) => (
            <ComentarioCard
              key={c.id}
              comentario={c}
              esSoporte={esSoporte}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

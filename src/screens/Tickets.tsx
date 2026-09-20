import { useMemo, useState } from 'react'
import {
  Bug, AlertTriangle, CheckCircle2, Clock, Ban, ChevronDown, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { useTickets } from '../hooks/useTickets'
import { SkeletonList } from '../components/ui/SkeletonCard'
import { codigoLegible } from '../lib/errores'
import type { Ticket, EstadoTicket } from '../types'

type Filtro = 'abiertos' | 'resueltos' | 'todos'

interface Props {
  onToast: (t: string, m?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const ESTILO_ESTADO: Record<EstadoTicket, { etiqueta: string; color: string; fondo: string }> = {
  nuevo:      { etiqueta: 'Nuevo',      color: 'text-danger',   fondo: 'bg-danger/10 border-danger/25'   },
  en_proceso: { etiqueta: 'En proceso', color: 'text-warning',  fondo: 'bg-warning/10 border-warning/25' },
  resuelto:   { etiqueta: 'Resuelto',   color: 'text-success',  fondo: 'bg-success/10 border-success/25' },
  descartado: { etiqueta: 'Descartado', color: 'text-white/40', fondo: 'bg-white/5 border-white/10'      },
}

const ETIQUETA_ORIGEN: Record<Ticket['origen'], string> = {
  render:     'Pantalla rota',
  promesa:    'Promesa sin atrapar',
  javascript: 'Error de JavaScript',
  consola:    'Registrado por la app',
  recurso:    'Archivo que no cargó',
  manual:     'Reportado a mano',
}

const SIGUIENTE: { estado: EstadoTicket; etiqueta: string; icono: typeof Clock }[] = [
  { estado: 'en_proceso', etiqueta: 'Tomar',     icono: Clock       },
  { estado: 'resuelto',   etiqueta: 'Resolver',  icono: CheckCircle2 },
  { estado: 'descartado', etiqueta: 'Descartar', icono: Ban         },
]

/** Qué decir cuando la lista sale vacía, según el filtro elegido. */
const VACIO: Record<Filtro, string> = {
  abiertos:  'No hay errores sin atender. Todo funcionando.',
  resueltos: 'Todavía no cerraste ninguno.',
  todos:     'La app no ha registrado ningún error.',
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-HN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

function TicketCard({
  ticket, onEstado,
}: Readonly<{ ticket: Ticket; onEstado: (t: Ticket, e: EstadoTicket) => void }>) {
  const [abierto, setAbierto] = useState(false)
  const estilo = ESTILO_ESTADO[ticket.estado] ?? ESTILO_ESTADO.nuevo
  const cerrado = ticket.estado === 'resuelto' || ticket.estado === 'descartado'

  return (
    <div className={`glass-card p-4 space-y-3 ${cerrado ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${estilo.fondo}`}>
          <Bug size={16} className={estilo.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${estilo.fondo} ${estilo.color}`}>
              {estilo.etiqueta}
            </span>
            {/* El contador es el que ordena la prioridad: un fallo que le pasa
                a mucha gente vale más que uno que ocurrió una sola vez. */}
            {ticket.veces > 1 && (
              <span className="text-[9px] font-bold text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full">
                {ticket.veces}× VECES
              </span>
            )}
            <span className="font-mono text-[10px] text-white/30">
              {codigoLegible(ticket.huella)}
            </span>
          </div>

          <p className="text-white/85 text-sm font-medium mt-1.5 break-words">
            {ticket.titulo}
          </p>

          <p className="text-white/30 text-[11px] mt-1">
            {ETIQUETA_ORIGEN[ticket.origen] ?? ticket.origen}
            {ticket.pantalla && ` · en ${ticket.pantalla}`}
            {' · último '}{fechaHora(ticket.ultima_vez)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {SIGUIENTE.filter((s) => s.estado !== ticket.estado).map(({ estado, etiqueta, icono: Icono }) => (
          <button
            key={estado}
            onClick={() => onEstado(ticket, estado)}
            className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/55 hover:bg-white/10 hover:text-white/80 active:scale-95 transition-all"
          >
            <Icono size={12} /> {etiqueta}
          </button>
        ))}

        {(ticket.detalle ?? ticket.navegador) && (
          <button
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-white/35 hover:text-white/60 transition-colors"
          >
            Detalle
            <ChevronDown size={13} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
        )}
      </div>

      {abierto && (
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-white/30">Primera vez</dt>
            <dd className="text-white/55">{fechaHora(ticket.primera_vez)}</dd>
            {ticket.ruta && (
              <>
                <dt className="text-white/30">Dirección</dt>
                <dd className="text-white/55 break-all">{ticket.ruta}</dd>
              </>
            )}
            {ticket.navegador && (
              <>
                <dt className="text-white/30">Navegador</dt>
                <dd className="text-white/55 break-all">{ticket.navegador}</dd>
              </>
            )}
          </dl>

          {ticket.detalle && (
            <pre className="overflow-x-auto rounded-xl bg-black/30 border border-white/[0.06] p-3 text-[10px] leading-relaxed text-white/50 whitespace-pre-wrap break-words">
              {ticket.detalle}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function Tickets({ onToast }: Readonly<Props>) {
  const { tickets, loading, error, abiertos, ocurrencias, cambiarEstado, refetch } = useTickets()
  const [filtro, setFiltro] = useState<Filtro>('abiertos')

  const visibles = useMemo(() => {
    if (filtro === 'abiertos') {
      return tickets.filter((t) => t.estado === 'nuevo' || t.estado === 'en_proceso')
    }
    if (filtro === 'resueltos') {
      return tickets.filter((t) => t.estado === 'resuelto' || t.estado === 'descartado')
    }
    return tickets
  }, [tickets, filtro])

  const handleEstado = async (t: Ticket, estado: EstadoTicket) => {
    const ok = await cambiarEstado(t.id, estado)
    if (!ok) return onToast('No se pudo actualizar', 'Revisá tu conexión', 'error')
    onToast(`Ticket ${ESTILO_ESTADO[estado].etiqueta.toLowerCase()}`, undefined, 'success')
  }

  function contenido() {
    if (error) {
      return (
        <div className="text-center py-12 space-y-3">
          <AlertTriangle size={32} className="text-warning mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      )
    }
    if (loading) return <SkeletonList rows={3} />
    if (visibles.length === 0) {
      return (
        <div className="text-center py-16">
          <ShieldCheck size={36} className="text-success/40 mx-auto mb-3" />
          <p className="text-white/40 text-sm">{VACIO[filtro]}</p>
        </div>
      )
    }
    return (
      <div className="grid gap-3">
        {visibles.map((t) => (
          <TicketCard key={t.id} ticket={t} onEstado={handleEstado} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Tickets de errores</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Los abre la app sola cuando algo falla. Uno por problema, no por vez.
          </p>
        </div>
        <button
          onClick={refetch}
          title="Actualizar"
          className="w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white/80 active:scale-90 transition-all"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="stat-label">Problemas</p>
          <p className="stat-value text-white mt-1">{tickets.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Sin cerrar</p>
          <p className={`stat-value mt-1 ${abiertos > 0 ? 'text-warning' : 'text-success'}`}>
            {abiertos}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Veces que pasó</p>
          <p className="stat-value text-white mt-1">{ocurrencias}</p>
          <p className="text-white/30 text-[11px] mt-0.5">sumando repeticiones</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/8 max-w-md">
        {([
          ['abiertos', 'Sin cerrar'],
          ['resueltos', 'Cerrados'],
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

      {contenido()}
    </div>
  )
}

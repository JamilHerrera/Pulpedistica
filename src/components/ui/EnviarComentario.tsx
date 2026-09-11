import { useState, type FormEvent } from 'react'
import { MessageSquare, X, Star, Send } from 'lucide-react'
import { MENSAJE_MIN, MENSAJE_MAX } from '../../hooks/useFeedback'
import type { TipoFeedback } from '../../types'

const TIPOS: { id: TipoFeedback; etiqueta: string }[] = [
  { id: 'sugerencia', etiqueta: 'Sugerencia' },
  { id: 'problema',   etiqueta: 'Problema'   },
  { id: 'elogio',     etiqueta: 'Me gustó'   },
  { id: 'otro',       etiqueta: 'Otro'       },
]

interface Props {
  pantalla: string
  onClose: () => void
  onEnviar: (
    tipo: TipoFeedback,
    mensaje: string,
    calificacion: number | null,
    pantalla: string,
  ) => Promise<boolean>
}

export function EnviarComentario({ pantalla, onClose, onEnviar }: Readonly<Props>) {
  const [tipo, setTipo] = useState<TipoFeedback>('sugerencia')
  const [mensaje, setMensaje] = useState('')
  const [calificacion, setCalificacion] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const restantes = MENSAJE_MAX - mensaje.trim().length
  const faltan = MENSAJE_MIN - mensaje.trim().length

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mensaje.trim().length < MENSAJE_MIN) {
      setError(`Contanos un poco más: faltan ${faltan} caracteres.`)
      return
    }

    setEnviando(true)
    const ok = await onEnviar(tipo, mensaje, calificacion, pantalla)
    setEnviando(false)

    if (ok) onClose()
    else setError('No se pudo enviar. Revisá tu conexión e intentá de nuevo.')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Enviar un comentario"
    >
      {/* El fondo es un boton de verdad: enfocable y activable con teclado. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-md glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up border-t-2 sm:border-t border-accent/40"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center">
              <MessageSquare size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Contanos qué te parece</h2>
              <p className="text-white/35 text-xs">Tu comentario llega a quien mantiene la app</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/30 active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-1.5">
          <span className="stat-label">¿De qué se trata?</span>
          <div className="grid grid-cols-4 gap-1 p-1 bg-white/5 rounded-2xl border border-white/8">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTipo(t.id)}
                aria-pressed={tipo === t.id}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                  tipo === t.id ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40'
                }`}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="stat-label">Puntaje (opcional)</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                // Tocar la misma estrella otra vez quita el puntaje: es la
                // unica forma de volver atras si se marco por error.
                onClick={() => setCalificacion(calificacion === n ? null : n)}
                aria-label={`${n} de 5`}
                aria-pressed={calificacion === n}
                className="active:scale-90 transition-transform"
              >
                <Star
                  size={26}
                  className={calificacion !== null && n <= calificacion
                    ? 'text-warning fill-warning'
                    : 'text-white/20'}
                />
              </button>
            ))}
            {calificacion !== null && (
              <span className="text-white/40 text-xs ml-1">{calificacion} de 5</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="comentario-mensaje" className="stat-label">Tu comentario</label>
          <textarea
            id="comentario-mensaje"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            maxLength={MENSAJE_MAX}
            rows={4}
            placeholder="Ej: me costó encontrar dónde se cambia el precio de un producto."
            className="input-field resize-none"
          />
          <p className={`text-xs ${restantes < 100 ? 'text-warning' : 'text-white/25'}`}>
            {mensaje.trim().length < MENSAJE_MIN
              ? `Mínimo ${MENSAJE_MIN} caracteres.`
              : `${restantes} caracteres disponibles.`}
          </p>
        </div>

        {error && (
          <p className="text-danger-light text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {enviando
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Send size={15} /> Enviar comentario</>}
        </button>
      </form>
    </div>
  )
}

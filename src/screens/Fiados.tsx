import { useMemo, useState, type FormEvent } from 'react'
import {
  Plus, X, HandCoins, Check, RotateCcw, Trash2, UserPlus, Users, AlertTriangle, Phone,
} from 'lucide-react'
import { useFiados } from '../hooks/useFiados'
import { SkeletonList } from '../components/ui/SkeletonCard'
import type { Cliente, Fiado } from '../types'

type Filtro = 'pendientes' | 'pagados' | 'todos'

interface Props {
  onToast: (t: string, m?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const money = (n: number) =>
  `L ${Number(n ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-HN', { day: 'numeric', month: 'short', year: 'numeric' })

// ─── Modal: registrar un fiado ───────────────────────────────────────────────

function NuevoFiadoModal({
  clientes, onClose, onCrearCliente, onRegistrar,
}: {
  clientes: Cliente[]
  onClose: () => void
  onCrearCliente: (nombre: string, telefono?: string) => Promise<Cliente | null>
  onRegistrar: (clienteId: string, monto: number) => Promise<boolean>
}) {
  const [modoNuevo, setModoNuevo] = useState(clientes.length === 0)
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? '')
  const [nombre, setNombre]       = useState('')
  const [telefono, setTelefono]   = useState('')
  const [monto, setMonto]         = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const montoNum = Number(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError('Ingresá un monto mayor que cero.')
      return
    }

    setGuardando(true)
    let destino = clienteId

    if (modoNuevo) {
      if (!nombre.trim()) {
        setError('Escribí el nombre del cliente.')
        setGuardando(false)
        return
      }
      const creado = await onCrearCliente(nombre, telefono)
      if (!creado) {
        setError('No se pudo crear el cliente.')
        setGuardando(false)
        return
      }
      destino = creado.id
    }

    if (!destino) {
      setError('Elegí un cliente.')
      setGuardando(false)
      return
    }

    const ok = await onRegistrar(destino, montoNum)
    setGuardando(false)
    if (ok) onClose()
    else setError('No se pudo registrar el fiado.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up border-t-2 sm:border-t border-brand/40"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand/20 flex items-center justify-center">
              <HandCoins size={16} className="text-brand-light" />
            </div>
            <h2 className="text-white font-bold text-base">Nuevo fiado</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/30 active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Cliente existente vs nuevo */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/8">
          <button
            type="button"
            onClick={() => setModoNuevo(false)}
            disabled={clientes.length === 0}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 ${
              !modoNuevo ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40'
            }`}
          >
            Cliente existente
          </button>
          <button
            type="button"
            onClick={() => setModoNuevo(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              modoNuevo ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40'
            }`}
          >
            Cliente nuevo
          </button>
        </div>

        {modoNuevo ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="fiado-nombre" className="stat-label">Nombre</label>
              <input
                id="fiado-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María López"
                className="input-field"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fiado-tel" className="stat-label">Teléfono (opcional)</label>
              <input
                id="fiado-tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 9999-9999"
                className="input-field"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="fiado-cliente" className="stat-label">Cliente</label>
            <select
              id="fiado-cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input-field appearance-none"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="fiado-monto" className="stat-label">Monto</label>
          <input
            id="fiado-monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="input-field text-2xl font-black tracking-tight"
          />
        </div>

        {error && (
          <p className="text-danger-light text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {guardando
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Plus size={16} strokeWidth={2.5} /> Registrar fiado</>}
        </button>
      </form>
    </div>
  )
}

// ─── Tarjeta de un fiado ─────────────────────────────────────────────────────

function FiadoCard({
  fiado, onTogglePagado, onEliminar,
}: {
  fiado: Fiado
  onTogglePagado: (f: Fiado) => void
  onEliminar: (f: Fiado) => void
}) {
  return (
    <div className={`glass-card p-4 flex items-center gap-3 ${fiado.pagado ? 'opacity-55' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        fiado.pagado ? 'bg-success/10' : 'bg-warning/10'
      }`}>
        <HandCoins size={17} className={fiado.pagado ? 'text-success' : 'text-warning'} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-semibold truncate">
            {fiado.clientes?.nombre ?? 'Cliente eliminado'}
          </p>
          {fiado.pagado && (
            <span className="text-[9px] font-bold text-success bg-success/10 border border-success/20 px-1.5 py-0.5 rounded-full shrink-0">
              PAGADO
            </span>
          )}
        </div>
        <p className="text-white/40 text-xs mt-0.5">
          {fiado.pagado && fiado.fecha_pago
            ? `Pagado el ${fecha(fiado.fecha_pago)}`
            : `Desde el ${fecha(fiado.fecha_registro)}`}
        </p>
        {fiado.clientes?.telefono && (
          <p className="text-white/25 text-[11px] flex items-center gap-1 mt-0.5">
            <Phone size={10} /> {fiado.clientes.telefono}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <p className={`font-black text-base ${fiado.pagado ? 'text-white/30 line-through' : 'text-warning'}`}>
          {money(fiado.monto)}
        </p>
        <button
          onClick={() => onTogglePagado(fiado)}
          title={fiado.pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
          className={`w-8 h-8 rounded-xl border flex items-center justify-center active:scale-90 transition-all ${
            fiado.pagado
              ? 'bg-white/5 border-white/10 text-white/40'
              : 'bg-success/10 border-success/25 text-success'
          }`}
        >
          {fiado.pagado ? <RotateCcw size={14} /> : <Check size={15} strokeWidth={2.5} />}
        </button>
        <button
          onClick={() => onEliminar(fiado)}
          title="Eliminar fiado"
          className="w-8 h-8 rounded-xl bg-danger/10 border border-danger/20 text-danger flex items-center justify-center active:scale-90 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export function Fiados({ onToast }: Props) {
  const {
    fiados, clientes, loading, error,
    totalAdeudado, clientesConDeuda, pendientesCount,
    crearCliente, registrarFiado, marcarPagado, eliminarFiado,
  } = useFiados()

  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [showNuevo, setShowNuevo] = useState(false)
  const [porEliminar, setPorEliminar] = useState<Fiado | null>(null)

  const visibles = useMemo(() => {
    if (filtro === 'pendientes') return fiados.filter((f) => !f.pagado)
    if (filtro === 'pagados') return fiados.filter((f) => f.pagado)
    return fiados
  }, [fiados, filtro])

  const handleToggle = async (f: Fiado) => {
    const ok = await marcarPagado(f.id, !f.pagado)
    if (!ok) return onToast('No se pudo actualizar', 'Revisá tu conexión', 'error')
    onToast(
      f.pagado ? 'Marcado como pendiente' : 'Fiado saldado',
      `${f.clientes?.nombre ?? ''} · ${money(f.monto)}`,
      f.pagado ? 'info' : 'success',
    )
  }

  const handleEliminar = async () => {
    if (!porEliminar) return
    const ok = await eliminarFiado(porEliminar.id)
    setPorEliminar(null)
    if (ok) onToast('Fiado eliminado', undefined, 'success')
    else onToast('No se pudo eliminar', 'Revisá tu conexión', 'error')
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Fiados</h2>
          <p className="text-white/40 text-sm mt-0.5">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-1.5 bg-brand text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-glow-brand shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} /> Nuevo fiado
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="stat-label">Por cobrar</p>
          <p className={`stat-value mt-1 ${totalAdeudado > 0 ? 'text-warning' : 'text-success'}`}>
            {money(totalAdeudado)}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Clientes deben</p>
          <p className="stat-value text-white mt-1">{clientesConDeuda}</p>
        </div>
        <div className="glass-card p-4">
          <p className="stat-label">Fiados abiertos</p>
          <p className="stat-value text-white mt-1">{pendientesCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/8 max-w-md">
        {([
          ['pendientes', 'Pendientes'],
          ['pagados', 'Pagados'],
          ['todos', 'Todos'],
        ] as [Filtro, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              filtro === id ? 'bg-brand text-white shadow-glow-brand' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {error ? (
        <div className="text-center py-12 space-y-3">
          <AlertTriangle size={32} className="text-warning mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <SkeletonList rows={4} />
      ) : visibles.length === 0 ? (
        <div className="text-center py-16">
          {clientes.length === 0 ? <Users size={36} className="text-white/15 mx-auto mb-3" />
                                 : <HandCoins size={36} className="text-white/15 mx-auto mb-3" />}
          <p className="text-white/40 text-sm">
            {filtro === 'pendientes' ? 'No hay fiados pendientes.'
              : filtro === 'pagados' ? 'Todavía no hay fiados saldados.'
              : 'Aún no registraste ningún fiado.'}
          </p>
          {clientes.length === 0 && (
            <button onClick={() => setShowNuevo(true)} className="mt-4 btn-primary text-sm py-2.5 px-5 inline-flex items-center gap-2">
              <UserPlus size={15} /> Registrar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((f) => (
            <FiadoCard
              key={f.id}
              fiado={f}
              onTogglePagado={handleToggle}
              onEliminar={setPorEliminar}
            />
          ))}
        </div>
      )}

      {showNuevo && (
        <NuevoFiadoModal
          clientes={clientes}
          onClose={() => setShowNuevo(false)}
          onCrearCliente={crearCliente}
          onRegistrar={async (id, monto) => {
            const ok = await registrarFiado(id, monto)
            if (ok) onToast('Fiado registrado', money(monto), 'success')
            else onToast('No se pudo registrar', 'Revisá tu conexión', 'error')
            return ok
          }}
        />
      )}

      {/* Confirmación de borrado */}
      {porEliminar && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setPorEliminar(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full sm:max-w-md glass-card rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 space-y-4 animate-slide-up border-t-2 sm:border-t border-danger/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-danger/20 flex items-center justify-center">
                <Trash2 size={15} className="text-danger" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base leading-tight">Eliminar fiado</h2>
                <p className="text-white/35 text-xs">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-white/40 text-xs uppercase tracking-wider">
                {porEliminar.clientes?.nombre ?? 'Cliente eliminado'}
              </p>
              <p className="text-white font-black text-2xl">{money(porEliminar.monto)}</p>
              <p className="text-white/40 text-xs">Desde el {fecha(porEliminar.fecha_registro)}</p>
            </div>

            <p className="text-white/45 text-xs leading-relaxed">
              Si el cliente ya te pagó, mejor marcalo como pagado: así queda el historial.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setPorEliminar(null)}
                className="flex-1 py-3 rounded-2xl bg-white/8 text-white/60 font-semibold text-sm active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                className="flex-1 py-3 rounded-2xl bg-danger text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

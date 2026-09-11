import { useState } from 'react'
import { Users, Shield, User, Copy, Check, Ticket, AlertTriangle, Plus } from 'lucide-react'
import { useEquipo, usePerfil, type RolNegocio, type Miembro } from '../hooks/usePerfil'
import { SkeletonList } from '../components/ui/SkeletonCard'

interface Props {
  onToast: (t: string, m?: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

const DESCRIPCION_ROL: Record<RolNegocio, string> = {
  admin:    'Hace todo: anula ventas, edita el catálogo, borra fiados y ve Análisis.',
  empleado: 'Cobra, consulta stock y anota fiados. No anula ventas ni edita el catálogo.',
}

function MiembroCard({
  miembro, esYo, onCambiarRol,
}: Readonly<{
  miembro: Miembro
  esYo: boolean
  onCambiarRol: (m: Miembro, rol: RolNegocio) => void
}>) {
  const esAdmin = miembro.rol === 'admin'
  const Icono = esAdmin ? Shield : User

  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        esAdmin ? 'bg-brand/15' : 'bg-white/5'
      }`}>
        <Icono size={17} className={esAdmin ? 'text-brand-light' : 'text-white/50'} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-sm font-semibold truncate">
            {miembro.nombre ?? 'Sin nombre'}
          </p>
          {esYo && (
            <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded-full shrink-0">
              VOS
            </span>
          )}
        </div>
        <p className="text-white/35 text-[11px] mt-0.5">{DESCRIPCION_ROL[miembro.rol]}</p>
      </div>

      <div className="shrink-0">
        {esYo ? (
          // Cambiarse el propio rol dejaria al negocio sin administrador.
          <span className="text-white/25 text-[11px]">No podés cambiar tu rol</span>
        ) : (
          <select
            value={miembro.rol}
            onChange={(e) => onCambiarRol(miembro, e.target.value as RolNegocio)}
            aria-label={`Rol de ${miembro.nombre ?? 'este usuario'}`}
            className="input-field appearance-none text-xs py-1.5 w-32"
          >
            <option value="admin">Administrador</option>
            <option value="empleado">Empleado</option>
          </select>
        )}
      </div>
    </div>
  )
}

export function Usuarios({ onToast }: Readonly<Props>) {
  const { esAdmin, nombreNegocio } = usePerfil()
  const { miembros, invitaciones, loading, error, cambiarRol, crearInvitacion } = useEquipo()
  const [miId, setMiId] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  // Se resuelve una vez: sirve para no dejar que alguien se degrade a sí mismo.
  if (miId === null && miembros.length > 0) {
    import('../lib/supabase').then(({ supabase }) =>
      supabase.auth.getUser().then(({ data }) => setMiId(data.user?.id ?? '')))
  }

  const handleCambiarRol = async (m: Miembro, rol: RolNegocio) => {
    const ok = await cambiarRol(m.id, rol)
    if (ok) onToast('Rol actualizado', `${m.nombre ?? 'El usuario'} ahora es ${rol}`, 'success')
    else onToast('No se pudo cambiar el rol', 'Solo un administrador puede hacerlo', 'error')
  }

  const handleInvitar = async (rol: RolNegocio) => {
    setCreando(true)
    const codigo = await crearInvitacion(rol)
    setCreando(false)
    if (codigo) onToast('Invitación creada', `Código ${codigo}`, 'success')
    else onToast('No se pudo crear la invitación', undefined, 'error')
  }

  const copiar = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(codigo)
      setTimeout(() => setCopiado(null), 2000)
    } catch {
      onToast('No se pudo copiar', 'Anotá el código a mano', 'warning')
    }
  }

  if (!esAdmin) {
    return (
      <div className="max-w-5xl">
        <div className="glass-card p-8 text-center space-y-3">
          <Shield size={36} className="text-white/15 mx-auto" />
          <h2 className="text-white font-bold">Solo para administradores</h2>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Esta sección la maneja quien administra el negocio. Si necesitás
            cambios en los permisos, pedíselo.
          </p>
        </div>
      </div>
    )
  }

  const vigentes = invitaciones.filter(
    (i) => i.usada_por === null && new Date(i.expira_en) > new Date(),
  )

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Usuarios</h2>
        <p className="text-white/40 text-sm mt-0.5">
          Quiénes pueden entrar a {nombreNegocio ?? 'tu negocio'} y qué puede hacer cada uno
        </p>
      </div>

      {error ? (
        <div className="text-center py-12 space-y-3">
          <AlertTriangle size={32} className="text-warning mx-auto" />
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      ) : loading ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-white/40" />
              <h3 className="text-white font-semibold text-sm">
                Equipo ({miembros.length})
              </h3>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 items-start">
              {miembros.map((m) => (
                <MiembroCard
                  key={m.id}
                  miembro={m}
                  esYo={m.id === miId}
                  onCambiarRol={handleCambiarRol}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Ticket size={15} className="text-white/40" />
                <h3 className="text-white font-semibold text-sm">Invitaciones</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleInvitar('empleado')}
                  disabled={creando}
                  className="flex items-center gap-1.5 bg-brand text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all shadow-glow-brand disabled:opacity-50"
                >
                  <Plus size={14} strokeWidth={2.5} /> Invitar empleado
                </button>
                <button
                  onClick={() => handleInvitar('admin')}
                  disabled={creando}
                  className="btn-ghost text-xs disabled:opacity-50"
                >
                  Invitar administrador
                </button>
              </div>
            </div>

            <p className="text-white/35 text-xs">
              Pasale el código a quien quieras sumar. Al crear su cuenta lo escribe
              y entra directo a este negocio, con el rol que elegiste. Vence en 7 días.
            </p>

            {vigentes.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-white/40 text-sm">No hay invitaciones sin usar.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {vigentes.map((i) => (
                  <div key={i.codigo} className="glass-card p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-lg tracking-[0.2em]">{i.codigo}</p>
                      <p className="text-white/35 text-[11px] mt-0.5">
                        Rol: {i.rol} · vence el{' '}
                        {new Date(i.expira_en).toLocaleDateString('es-HN', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => copiar(i.codigo)}
                      title="Copiar código"
                      className="w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 active:scale-90 transition-all"
                    >
                      {copiado === i.codigo
                        ? <Check size={15} className="text-success" />
                        : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

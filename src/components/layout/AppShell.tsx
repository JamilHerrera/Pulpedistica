import type { ReactNode } from 'react'
import { Home, TrendingUp, ShoppingCart, HandCoins, Package, BarChart2, LogOut } from 'lucide-react'
import type { Screen } from '../../types'

interface NavItem {
  id: Screen
  icon: typeof Home
  label: string
  /** Etiqueta corta para la barra inferior en móvil. */
  labelMovil: string
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  icon: Home,         label: 'Inicio',      labelMovil: 'Inicio'   },
  { id: 'semaforo',   icon: TrendingUp,   label: 'Semáforo',    labelMovil: 'Semáforo' },
  { id: 'venta',      icon: ShoppingCart, label: 'Nueva venta', labelMovil: 'Venta'    },
  { id: 'fiados',     icon: HandCoins,    label: 'Fiados',      labelMovil: 'Fiados'   },
  { id: 'inventario', icon: Package,      label: 'Inventario',  labelMovil: 'Stock'    },
  { id: 'analisis',   icon: BarChart2,    label: 'Análisis',    labelMovil: 'Análisis' },
]

const TITLES: Record<Screen, string> = {
  dashboard:  'Inicio',
  semaforo:   'Semáforo de inventario',
  venta:      'Nueva venta',
  fiados:     'Fiados',
  inventario: 'Inventario',
  analisis:   'Análisis',
}

interface Props {
  active: Screen
  onChange: (s: Screen) => void
  onSignOut: () => void
  children: ReactNode
}

export function AppShell({ active, onChange, onSignOut, children }: Props) {
  const today = new Date().toLocaleDateString('es-HN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="min-h-screen bg-app text-white font-sans">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-white/[0.06] bg-surface">
        <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
          <span className="font-black tracking-tight text-[15px]">PulpeAnálisis ✦</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand/15 text-brand-light'
                    : 'text-white/45 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:bg-white/5 hover:text-white/80 transition-colors"
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido ─────────────────────────────────────────────────── */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 border-b border-white/[0.06] bg-app/85 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px] truncate">{TITLES[active]}</h1>
            <p className="text-white/35 text-xs capitalize truncate">{today}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="lg:hidden font-black text-sm tracking-tight">PulpeAnálisis ✦</span>
            <button
              onClick={onSignOut}
              title="Cerrar sesión"
              className="lg:hidden w-9 h-9 rounded-xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/50 active:scale-90 transition-all"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ── Nav inferior (solo móvil) ─────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-surface/95 backdrop-blur-xl safe-bottom">
        <div className="flex items-center justify-around px-0.5 py-1.5">
          {NAV_ITEMS.map(({ id, icon: Icon, labelMovil }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl no-select transition-all active:scale-90"
              >
                <Icon
                  size={19}
                  className={isActive ? 'text-brand-light' : 'text-white/35'}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-[10px] font-medium ${isActive ? 'text-brand-light' : 'text-white/35'}`}>
                  {labelMovil}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

import { Home, TrendingUp, ShoppingCart, Package, BarChart2 } from 'lucide-react'
import type { Screen } from '../../types'

interface Props {
  active: Screen
  onChange: (s: Screen) => void
  cartCount: number
}

const tabs: { id: Screen; icon: typeof Home; label: string }[] = [
  { id: 'dashboard',  icon: Home,        label: 'Inicio'     },
  { id: 'semaforo',   icon: TrendingUp,  label: 'Semáforo'   },
  { id: 'venta',      icon: ShoppingCart,label: 'Venta'      },
  { id: 'inventario', icon: Package,     label: 'Stock'      },
  { id: 'analisis',   icon: BarChart2,   label: 'Análisis'   },
]

export function BottomNav({ active, onChange, cartCount }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:absolute"
      style={{ maxWidth: 'inherit' }}
    >
      <div className="mx-3 mb-4 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(13,13,28,0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const isActive = active === tab.id
            const Icon = tab.icon
            const isCTA = tab.id === 'venta'

            if (isCTA) {
              return (
                <button
                  key={tab.id}
                  onClick={() => onChange(tab.id)}
                  className="relative flex flex-col items-center gap-0.5 -mt-5 no-select"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
                      isActive
                        ? 'bg-gradient-to-br from-brand to-brand-dark shadow-glow-brand'
                        : 'bg-gradient-to-br from-brand/80 to-brand-dark/80 shadow-lg'
                    }`}
                  >
                    <Icon size={22} className="text-white" strokeWidth={2.5} />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-glow-danger">
                        {cartCount > 9 ? '9+' : cartCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-brand-light' : 'text-white/40'}`}>
                    {tab.label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-200 active:scale-90 no-select"
              >
                <div className={`relative p-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand/20' : ''}`}>
                  <Icon
                    size={20}
                    className={`transition-colors duration-200 ${isActive ? 'text-brand-light' : 'text-white/35'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-1 h-1 bg-brand-light rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-200 ${isActive ? 'text-brand-light' : 'text-white/35'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

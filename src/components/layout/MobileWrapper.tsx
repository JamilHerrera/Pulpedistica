import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

function useIsDesktop() {
  const query = '(min-width: 768px)' // Tailwind's `md` breakpoint
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setIsDesktop(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

export function MobileWrapper({ children }: Props) {
  const isDesktop = useIsDesktop()

  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center p-4 md:p-8"
      style={{ background: 'radial-gradient(ellipse at 20% 20%, #120826 0%, #030308 40%), radial-gradient(ellipse at 80% 80%, #051420 0%, transparent 50%)' }}>

      {/* Fondo decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand/5 rounded-full blur-2xl" />
      </div>

      {isDesktop ? (
        /* Phone frame - visible solo en desktop */
        <div className="relative">
          {/* Botones laterales decorativos */}
          <div className="absolute -right-[5px] top-28 w-[4px] h-12 bg-white/10 rounded-r-sm" />
          <div className="absolute -left-[5px] top-20 w-[4px] h-8 bg-white/10 rounded-l-sm" />
          <div className="absolute -left-[5px] top-32 w-[4px] h-14 bg-white/10 rounded-l-sm" />
          <div className="absolute -left-[5px] top-50 w-[4px] h-14 bg-white/10 rounded-l-sm" />

          {/* Marco del teléfono */}
          <div
            className="relative w-[390px] overflow-hidden"
            style={{
              height: '844px',
              borderRadius: '50px',
              background: 'linear-gradient(145deg, #1a1a2e, #0d0d1c)',
              boxShadow: '0 60px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(255,255,255,0.03)',
            }}
          >
            {/* Pantalla interior */}
            <div
              className="absolute inset-[3px] overflow-hidden bg-app"
              style={{ borderRadius: '47px' }}
            >
              {/* Dynamic Island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-8 bg-black rounded-full z-50 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-white/20 rounded-full" />
                <div className="w-3 h-3 bg-white/10 rounded-full border border-white/20" />
              </div>

              {/* Contenido scrollable */}
              <div className="h-full overflow-y-auto scrollable pt-12 pb-safe" style={{ borderRadius: '47px' }}>
                {children}
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/25 rounded-full z-50" />
            </div>
          </div>
        </div>
      ) : (
        /* Mobile nativo - ocupa toda la pantalla */
        <div className="fixed inset-0 overflow-hidden bg-app">
          <div className="h-full overflow-y-auto scrollable">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

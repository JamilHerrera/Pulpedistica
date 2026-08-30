import { useState, useCallback } from 'react'
import { LogOut } from 'lucide-react'
import { MobileWrapper } from './components/layout/MobileWrapper'
import { BottomNav } from './components/layout/BottomNav'
import { Toast } from './components/ui/Toast'
import { Dashboard } from './screens/Dashboard'
import { Semaforo } from './screens/Semaforo'
import { NuevaVenta } from './screens/NuevaVenta'
import { Inventario } from './screens/Inventario'
import { Analisis } from './screens/Analisis'
import { supabase } from './lib/supabase'
import type { Screen, ToastMessage, ToastType } from './types'

let toastCounter = 0

export default function AdminApp() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback(
    (title: string, message?: string, type: ToastType = 'info') => {
      const id = String(++toastCounter)
      setToasts((prev) => [...prev.slice(-2), { id, type, title, message }])
    },
    [],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleNavigate = useCallback((s: Screen) => setScreen(s), [])

  const screens: Record<Screen, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={handleNavigate} onToast={addToast} />,
    semaforo:  <Semaforo />,
    venta:     <NuevaVenta onToast={addToast} />,
    inventario:<Inventario onToast={addToast} />,
    analisis:  <Analisis />,
  }

  return (
    <MobileWrapper>
      <div className="relative h-full bg-app">
        {/* Toast notifications */}
        <Toast toasts={toasts} onRemove={removeToast} />

        {/* Cerrar sesión */}
        <button
          onClick={() => supabase.auth.signOut()}
          title="Cerrar sesión"
          className="fixed top-4 right-4 z-40 md:absolute w-8 h-8 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-white/50 active:scale-90 transition-all"
        >
          <LogOut size={14} />
        </button>

        {/* Screen content */}
        <div key={screen} className="animate-fade-in min-h-full">
          {screens[screen]}
        </div>

        {/* Bottom navigation */}
        <BottomNav active={screen} onChange={setScreen} cartCount={0} />
      </div>
    </MobileWrapper>
  )
}

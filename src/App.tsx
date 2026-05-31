import { useState, useCallback } from 'react'
import { MobileWrapper } from './components/layout/MobileWrapper'
import { BottomNav } from './components/layout/BottomNav'
import { Toast } from './components/ui/Toast'
import { Dashboard } from './screens/Dashboard'
import { Semaforo } from './screens/Semaforo'
import { NuevaVenta } from './screens/NuevaVenta'
import { Inventario } from './screens/Inventario'
import { Analisis } from './screens/Analisis'
import type { Screen, ToastMessage, ToastType } from './types'

let toastCounter = 0

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [cartCount, setCartCount] = useState(0)
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

        {/* Screen content */}
        <div key={screen} className="animate-fade-in min-h-full">
          {screens[screen]}
        </div>

        {/* Bottom navigation */}
        <BottomNav active={screen} onChange={setScreen} cartCount={cartCount} />
      </div>
    </MobileWrapper>
  )
}

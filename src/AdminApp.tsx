import { useState, useCallback } from 'react'
import { AppShell } from './components/layout/AppShell'
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
    <AppShell
      active={screen}
      onChange={setScreen}
      onSignOut={() => supabase.auth.signOut()}
    >
      <Toast toasts={toasts} onRemove={removeToast} />

      <div key={screen} className="animate-fade-in">
        {screens[screen]}
      </div>
    </AppShell>
  )
}

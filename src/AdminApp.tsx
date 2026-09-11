import { useState, useCallback, useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Toast } from './components/ui/Toast'
import { Dashboard } from './screens/Dashboard'
import { Semaforo } from './screens/Semaforo'
import { NuevaVenta } from './screens/NuevaVenta'
import { Fiados } from './screens/Fiados'
import { Inventario } from './screens/Inventario'
import { Analisis } from './screens/Analisis'
import { Comentarios } from './screens/Comentarios'
import { Usuarios } from './screens/Usuarios'
import { EnviarComentario } from './components/ui/EnviarComentario'
import { usePerfil } from './hooks/usePerfil'
import { useFeedback } from './hooks/useFeedback'
import { supabase } from './lib/supabase'
import { migrarPreciosLocales } from './lib/migrarPrecios'
import { limpiarCache } from './lib/cache'
import type { Screen, ToastMessage, ToastType } from './types'

let toastCounter = 0

const PANTALLAS: Screen[] = ['dashboard', 'semaforo', 'venta', 'fiados', 'inventario', 'analisis', 'usuarios', 'comentarios']

/**
 * Pantalla inicial según `?pantalla=` de la URL.
 *
 * El panel navega con estado interno, así que sin esto todas las secciones
 * comparten la dirección /admin y no se puede enlazar a una en concreto. Con
 * el parámetro se puede mandar a alguien directo al inventario o al semáforo.
 */
function pantallaInicial(): Screen {
  const pedida = new URLSearchParams(window.location.search).get('pantalla')
  return PANTALLAS.includes(pedida as Screen) ? (pedida as Screen) : 'dashboard'
}

export default function AdminApp() {
  const [screen, setScreen] = useState<Screen>(pantallaInicial)
  const { esAdmin, esSoporte } = usePerfil()
  const { enviar } = useFeedback()
  const [comentando, setComentando] = useState(false)

  // Sube por única vez los precios que hayan quedado en este navegador.
  useEffect(() => { migrarPreciosLocales() }, [])

  // Refleja la sección en la URL para que se pueda compartir o recargar sin
  // volver al inicio. `replaceState` evita llenar el historial del navegador.
  const irA = useCallback((s: Screen) => {
    setScreen(s)
    const url = new URL(window.location.href)
    if (s === 'dashboard') url.searchParams.delete('pantalla')
    else url.searchParams.set('pantalla', s)
    window.history.replaceState(null, '', url)
  }, [])

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

  const screens: Record<Screen, React.ReactNode> = {
    dashboard: <Dashboard onNavigate={irA} onToast={addToast} />,
    semaforo:  <Semaforo />,
    venta:     <NuevaVenta onToast={addToast} />,
    fiados:    <Fiados onToast={addToast} />,
    inventario:<Inventario onToast={addToast} />,
    analisis:  <Analisis />,
    usuarios:  <Usuarios onToast={addToast} />,
    comentarios: <Comentarios onToast={addToast} />,
  }

  return (
    <AppShell
      active={screen}
      onChange={irA}
      esAdmin={esAdmin}
      esSoporte={esSoporte}
      onComentar={() => setComentando(true)}
      onSignOut={() => {
        // Sin esto, la siguiente sesion veria datos cacheados de la anterior.
        limpiarCache()
        supabase.auth.signOut()
      }}
    >
      <Toast toasts={toasts} onRemove={removeToast} />

      <div key={screen} className="animate-fade-in">
        {screens[screen]}
      </div>

      {comentando && (
        <EnviarComentario
          pantalla={screen}
          onClose={() => setComentando(false)}
          onEnviar={async (tipo, mensaje, calificacion, pantalla) => {
            const ok = await enviar(tipo, mensaje, calificacion, pantalla)
            if (ok) addToast('¡Gracias!', 'Tu comentario fue enviado', 'success')
            else addToast('No se pudo enviar', 'Revisá tu conexión', 'error')
            return ok
          }}
        />
      )}
    </AppShell>
  )
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { registrarServiceWorker } from './lib/registrarSW'
import { instalarCapturaDeErrores } from './lib/tickets'

// Antes que nada: un error durante el arranque es de los peores —deja la
// pantalla en blanco— y es justo el que se perderia si esto fuera despues.
instalarCapturaDeErrores()

registrarServiceWorker()

const root = createRoot(document.getElementById('root')!)

const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

if (missingEnv) {
  root.render(
    <StrictMode>
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-app px-6 text-center font-sans">
        <p className="text-lg font-semibold text-danger-light">Configuración incompleta</p>
        <p className="max-w-sm text-sm text-white/60">
          Faltan las variables de entorno de Supabase. Copiá <code className="text-white/80">env.example</code> a{' '}
          <code className="text-white/80">.env</code> y completá <code className="text-white/80">VITE_SUPABASE_URL</code> y{' '}
          <code className="text-white/80">VITE_SUPABASE_ANON_KEY</code>, luego reiniciá el servidor.
        </p>
      </div>
    </StrictMode>,
  )
} else {
  Promise.all([
    import('./AdminApp.tsx'),
    import('./screens/Landing.tsx'),
    import('./screens/NotFound.tsx'),
    import('./components/routing/ProtectedRoute.tsx'),
    import('./components/ui/BarreraDeError.tsx'),
  ]).then(([{ default: AdminApp }, { Landing }, { NotFound }, { ProtectedRoute }, { BarreraDeError }]) => {
    root.render(
      <StrictMode>
        {/* La de más afuera: atrapa lo que reviente en la portada, en el 404
            o en el panel antes de que monte su propia barrera por sección. */}
        <BarreraDeError>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminApp />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </BarreraDeError>
      </StrictMode>,
    )
  })
}

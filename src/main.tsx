import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

if (missingEnv) {
  root.render(
    <StrictMode>
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-app px-6 text-center font-sans">
        <p className="text-lg font-semibold text-danger-light">Configuración incompleta</p>
        <p className="max-w-sm text-sm text-white/60">
          Faltan las variables de entorno de Supabase. Copiá <code className="text-white/80">.env.example</code> a{' '}
          <code className="text-white/80">.env</code> y completá <code className="text-white/80">VITE_SUPABASE_URL</code> y{' '}
          <code className="text-white/80">VITE_SUPABASE_ANON_KEY</code>, luego reiniciá el servidor.
        </p>
      </div>
    </StrictMode>,
  )
} else {
  import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}

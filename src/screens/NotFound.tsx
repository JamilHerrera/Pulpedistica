import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen bg-app font-sans text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl font-black text-white/10">404</p>
      <h1 className="text-xl font-bold">Esta página no existe</h1>
      <p className="text-white/45 text-sm max-w-xs">
        Revisá el enlace o volvé al inicio.
      </p>
      <Link to="/" className="btn-primary inline-flex items-center gap-2">
        <Home size={16} /> Volver al inicio
      </Link>
    </div>
  )
}

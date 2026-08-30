import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock, Mail, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/admin" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)

    if (signInError) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 font-sans">
      <div className="w-full max-w-sm glass-card p-6 space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-brand/15 flex items-center justify-center">
            <Lock size={20} className="text-brand-light" />
          </div>
          <h1 className="text-white font-bold text-xl">Iniciar sesión</h1>
          <p className="text-white/40 text-sm">Accedé al panel de PulpeAnálisis</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="stat-label">Correo</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-10"
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="stat-label">Contraseña</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-10"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-danger-light text-sm bg-danger/10 border border-danger/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><LogIn size={16} /> Entrar</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}

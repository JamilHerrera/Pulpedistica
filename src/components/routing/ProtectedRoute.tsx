import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  // El middleware ya frena al visitante anonimo antes de servir el documento;
  // esto cubre el caso de una sesion que expira con la cookie todavia presente.
  useEffect(() => {
    if (!loading && !session) window.location.replace('/login')
  }, [loading, session])

  if (loading || !session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-app">
        <div className="w-8 h-8 border-2 border-white/20 border-t-brand rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}

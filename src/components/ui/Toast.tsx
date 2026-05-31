import { useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ToastMessage } from '../../types'

interface Props {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

const icons = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const colors = {
  success: 'text-success border-success/30 bg-success/10',
  error:   'text-danger border-danger/30 bg-danger/10',
  warning: 'text-warning border-warning/30 bg-warning/10',
  info:    'text-accent border-accent/30 bg-accent/10',
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const Icon = icons[toast.type]

  useEffect(() => {
    const t = setTimeout(onRemove, 3500)
    return () => clearTimeout(t)
  }, [onRemove])

  return (
    <div className={`flex items-start gap-3 p-3 rounded-2xl border backdrop-blur-xl animate-slide-in-right ${colors[toast.type]}`}
      style={{ background: 'rgba(13,13,28,0.95)' }}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{toast.title}</p>
        {toast.message && <p className="text-xs text-white/60 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={onRemove} className="text-white/40 hover:text-white transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}

export function Toast({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-16 right-0 left-0 z-50 px-4 flex flex-col gap-2 pointer-events-none md:absolute">
      <div className="pointer-events-auto flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
        ))}
      </div>
    </div>
  )
}

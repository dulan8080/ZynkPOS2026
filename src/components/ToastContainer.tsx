import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { usePOS } from '../store'

export function ToastContainer() {
  const { toasts, removeToast } = usePOS()

  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />,
    error:   <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />,
    info:    <Info className="w-4 h-4 text-accent flex-shrink-0" />,
  }

  const borders = {
    success: 'border-success/25 bg-success/8',
    error:   'border-danger/25 bg-danger/8',
    warning: 'border-warning/25 bg-warning/8',
    info:    'border-accent/25 bg-accent/8',
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            flex items-start gap-3 px-4 py-3 rounded-xl border
            backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.4)]
            animate-slide-up
            ${borders[t.type]}
          `}
        >
          {icons[t.type]}
          <p className="flex-1 text-text-1 text-sm font-medium">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="text-text-3 hover:text-text-2 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

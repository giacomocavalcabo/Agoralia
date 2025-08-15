import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext({ success: () => {}, error: () => {}, info: () => {}, warn: () => {} })

function Toast({ id, type, message, onClose, duration = 3000 }) {
  useEffect(() => {
    if (type === 'error') return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [type, duration, onClose])
  return (
    <div
      role="status"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`toast ${type}`}
      onClick={onClose}
    >
      <div className="toast-body">{String(message)}</div>
      <style>{`
        .toast { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:#fff; box-shadow:0 10px 20px rgba(0,0,0,.12); cursor:pointer; }
        .toast.success { border-color: #10a37f33 }
        .toast.error { border-color: #dc262633 }
        .toast.info { border-color: #2563eb33 }
        .toast.warn { border-color: #f59e0b33 }
        .toast-body { font-size:14px; color:#111827 }
      `}</style>
    </div>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const remove = useCallback((id) => setToasts((arr) => arr.filter((t) => t.id !== id)), [])
  const push = useCallback((type, message, opts = {}) => {
    const id = ++idRef.current
    setToasts((arr) => [...arr, { id, type, message, duration: opts.duration }])
    if (type !== 'error') setTimeout(() => remove(id), opts.duration ?? 3000)
  }, [remove])

  const api = useMemo(() => ({
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    warn: (m, o) => push('warn', m, o),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {toasts.map((t) => (
            <Toast key={t.id} id={t.id} type={t.type} message={t.message} duration={t.duration} onClose={() => remove(t.id)} />
          ))}
          <style>{`
            .toast-stack { position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 9999; }
            [dir="rtl"] .toast-stack { right: auto; left: 16px; }
          `}</style>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }

// Bridge: allow imperative events (for quick wiring)
if (typeof window !== 'undefined') {
  window.addEventListener('toast:show', (e) => {
    const d = e?.detail || {}
    const root = document.querySelector('[data-toast-root]')
    // no-op; context-based preferred. This keeps backward-compat.
  })
}



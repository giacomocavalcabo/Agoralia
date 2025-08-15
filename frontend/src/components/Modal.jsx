import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ open, onClose, title, children, footer }) {
  const firstFocusable = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    // Focus trap basic
    const focusables = () => Array.from(document.querySelectorAll('.modal-card button, .modal-card [href], .modal-card input, .modal-card select, .modal-card textarea, .modal-card [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'))
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const nodes = focusables()
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    // autofocus
    setTimeout(() => { const nodes = focusables(); if (nodes[0]) nodes[0].focus() }, 0)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onKeyDown) }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div aria-modal="true" role="dialog" className="modal-root" onMouseDown={onClose}>
      <div className="modal-overlay" />
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        {title && <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>}
        <div>{children}</div>
        {footer}
      </div>
      <style>{`
        .modal-root { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-overlay { position: absolute; inset: 0; background: rgba(17,24,39,0.5); backdrop-filter: blur(2px); }
        .modal-card { position: relative; width: 720px; max-width: 92vw; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
      `}</style>
    </div>,
    document.body
  )
}



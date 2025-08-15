import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Drawer({ open, onClose, title, children, footer, side = 'right', width = 420 }) {
  if (!open) return null
  // Basic focus trap
  useEffect(() => {
    if (!open) return
    const selector = '.drawer-card button, .drawer-card [href], .drawer-card input, .drawer-card select, .drawer-card textarea, .drawer-card [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(document.querySelectorAll(selector)).filter((el) => !el.hasAttribute('disabled'))
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
    setTimeout(() => { const nodes = focusables(); if (nodes[0]) nodes[0].focus() }, 0)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  return createPortal(
    <div role="dialog" aria-modal="true" className="drawer-root" onMouseDown={onClose}>
      <div className="drawer-overlay" />
      <div className={`drawer-card side-${side}`} style={{ width }} onMouseDown={(e)=> e.stopPropagation()}>
        {title && <h2 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h2>}
        <div>{children}</div>
        {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
      </div>
      <style>{`
        .drawer-root { position: fixed; inset: 0; z-index: 1000; }
        .drawer-overlay { position: absolute; inset: 0; background: rgba(17,24,39,0.5); backdrop-filter: blur(2px); }
        .drawer-card { position: absolute; top: 0; bottom: 0; background: #fff; border: 1px solid #e5e7eb; padding: 16px; box-shadow: -10px 0 30px rgba(0,0,0,.15); overflow: auto; }
        .side-right { right: 0; border-left: 1px solid #e5e7eb; }
        .side-left { left: 0; border-right: 1px solid #e5e7eb; }
      `}</style>
    </div>,
    document.body
  )
}



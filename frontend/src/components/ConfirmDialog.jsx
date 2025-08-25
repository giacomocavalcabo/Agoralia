import { Fragment } from 'react'

export default function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onClose, children }) {
  if (!open) return null
  
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose}/>
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold">{title}</h3>
        {body && <p className="mt-2 text-sm text-gray-600">{body}</p>}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>{cancelLabel}</button>
          <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

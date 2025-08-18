import { useEffect, useRef } from 'react'

export default function Modal({ title, open, onClose, children, footer }){
	const dialogRef = useRef(null)
	useEffect(()=>{
		function onKey(e){ if (e.key === 'Escape') onClose?.() }
		if (open) document.addEventListener('keydown', onKey)
		return ()=> document.removeEventListener('keydown', onKey)
	},[open,onClose])
	if (!open) return null
	return (
		<div role="dialog" aria-modal="true" aria-label={title || 'Dialog'} ref={dialogRef} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'grid', placeItems:'center', zIndex:100 }}>
			<div className="panel" style={{ width:560, maxWidth:'90vw', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'var(--sh-card)' }}>
				<div style={{ display:'flex', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
					<div style={{ fontWeight:700 }}>{title}</div>
					<button onClick={onClose} aria-label="Close" style={{ marginLeft:'auto', border:'1px solid var(--border)', background:'var(--surface)', padding:'6px 8px', borderRadius:8, cursor:'pointer' }}>✕</button>
				</div>
				<div style={{ padding:16 }}>
					{children}
				</div>
				{footer && <div style={{ padding:12, borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end' }}>{footer}</div>}
			</div>
		</div>
	)
}



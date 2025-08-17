import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext({ toast: () => {} })

export function ToastProvider({ children }) {
	const [items, setItems] = useState([])
	const toast = useCallback((msg, opts = {}) => {
		const id = Math.random().toString(36).slice(2)
		setItems((arr) => [...arr, { id, msg }])
		setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), opts.duration || 2500)
	}, [])
	return (
		<ToastCtx.Provider value={{ toast }}>
			{children}
			<div style={{ position: 'fixed', right: 12, bottom: 12, display: 'grid', gap: 8, zIndex: 50 }}>
				{items.map((t) => (
					<div key={t.id} style={{ background: '#111827', color: 'white', padding: '10px 12px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,.2)' }}>{t.msg}</div>
				))}
			</div>
		</ToastCtx.Provider>
	)
}

export function useToast() { return useContext(ToastCtx) }

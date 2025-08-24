import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext({ toast: () => {} })

export function ToastProvider({ children }) {
	const [items, setItems] = useState([])
	const toast = useCallback((msg, opts = {}) => {
		const id = Math.random().toString(36).slice(2)
		
		// Gestisce sia stringhe che oggetti
		let displayMsg = msg
		if (typeof msg === 'object' && msg !== null) {
			// Se è un oggetto, prova a estrarre il messaggio
			displayMsg = msg.message || msg.title || msg.description || msg.text || JSON.stringify(msg)
		} else if (typeof msg !== 'string') {
			// Se non è una stringa, converti in stringa
			displayMsg = String(msg)
		}
		
		setItems((arr) => [...arr, { id, msg: displayMsg }])
		setTimeout(() => setItems((arr) => arr.filter((t) => t.id !== id)), opts.duration || 2500)
	}, [])
	return (
		<ToastCtx.Provider value={{ toast }}>
			{children}
			<div className="fixed right-3 bottom-3 grid gap-2 z-50">
				{items.map((t) => (
					<div key={t.id} className="rounded-xl border border-line bg-ink-900 text-white px-3 py-2 shadow-soft">{t.msg}</div>
				))}
			</div>
		</ToastCtx.Provider>
	)
}

export function useToast() { return useContext(ToastCtx) }

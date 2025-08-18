import { useEffect, useRef, useState } from 'react'

export default function AvatarMenu(){
	const [open, setOpen] = useState(false)
	const ref = useRef(null)
	useEffect(()=>{
		function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
		document.addEventListener('mousedown', onDoc)
		return ()=> document.removeEventListener('mousedown', onDoc)
	},[])
	return (
		<div ref={ref} className="relative">
			<button onClick={()=> setOpen(v=>!v)} className="h-9 w-9 rounded-xl border border-line bg-bg-app text-ink-600 hover:text-ink-900" aria-haspopup="menu" aria-expanded={open}>
				<span className="sr-only">Open user menu</span>
				👤
			</button>
			{open && (
				<div role="menu" className="absolute right-0 mt-2 w-40 rounded-xl border border-line bg-bg-card shadow-soft p-1 text-sm">
					<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Profile</button>
					<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Settings</button>
					<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Log out</button>
				</div>
			)}
		</div>
	)
}



import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMe } from '../lib/me'

export default function AvatarMenu(){
	const [open, setOpen] = useState(false)
	const ref = useRef(null)
	
	// Fetch current user
	const { data: me, isLoading } = useQuery({ 
		queryKey: ['me'], 
		queryFn: fetchMe, 
		retry: false 
	})
	
	useEffect(()=>{
		function onDoc(e){ if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
		document.addEventListener('mousedown', onDoc)
		return ()=> document.removeEventListener('mousedown', onDoc)
	},[])
	
	return (
		<div ref={ref} className="relative">
			<button onClick={()=> setOpen(v=>!v)} className="h-9 w-9 rounded-xl border border-line bg-bg-app text-ink-600 hover:text-ink-900" aria-haspopup="menu" aria-expanded={open}>
				<span className="sr-only">Open user menu</span>
				{me ? (
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium">{me.name || me.email.split('@')[0]}</span>
						<span>👤</span>
					</div>
				) : (
					<span>👤</span>
				)}
			</button>
			{open && (
				<div role="menu" className="absolute right-0 mt-2 w-40 rounded-xl border border-line bg-bg-card shadow-soft p-1 text-sm">
					{me ? (
						<>
							<div className="px-2 py-1.5 text-xs text-ink-500 border-b border-line mb-1">
								{me.email}
							</div>
							<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Profile</button>
							<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Settings</button>
							<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Log out</button>
						</>
					) : (
						<button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-bg-app">Login</button>
					)}
				</div>
			)}
		</div>
	)
}



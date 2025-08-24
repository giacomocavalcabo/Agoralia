import { useEffect, useState } from 'react'

export default function DashboardHeader({ title='Dashboard', range, onRangeChange, onQuick }){
	const [mounted, setMounted] = useState(false)
	
	useEffect(() => {
		setMounted(true)
	}, [])
	
	useEffect(()=>{
		if (!mounted) return
		
		function onKey(e){
			if (e.key.toLowerCase()==='n') onQuick?.('new_campaign')
			if (e.key.toLowerCase()==='i') onQuick?.('import')
			if (e.key.toLowerCase()==='s') onQuick?.('schedule')
			if (e.key==='/'){ const el=document.getElementById('global-search'); if(el){ e.preventDefault(); el.focus() } }
		}
		document.addEventListener('keydown', onKey)
		return ()=> document.removeEventListener('keydown', onKey)
	},[onQuick, mounted])
	function setDays(d){
		const to = new Date(); const from = new Date(); if (d===0){ from.setHours(0,0,0,0) } else { from.setDate(to.getDate()-d+1); from.setHours(0,0,0,0) }
		onRangeChange?.({ from, to })
	}
	return (
		<div className="flex items-center gap-2">
			<h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
			{/* Removed unnecessary buttons: Oggi, 7g, 30g, Importa, Schedula */}
		</div>
	)
}



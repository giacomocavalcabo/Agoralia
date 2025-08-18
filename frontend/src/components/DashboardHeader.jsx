import { useEffect } from 'react'

export default function DashboardHeader({ title='Dashboard', range, onRangeChange, onQuick }){
	useEffect(()=>{
		function onKey(e){
			if (e.key.toLowerCase()==='n') onQuick?.('new_campaign')
			if (e.key.toLowerCase()==='i') onQuick?.('import')
			if (e.key.toLowerCase()==='s') onQuick?.('schedule')
			if (e.key==='/'){ const el=document.getElementById('global-search'); if(el){ e.preventDefault(); el.focus() } }
		}
		document.addEventListener('keydown', onKey)
		return ()=> document.removeEventListener('keydown', onKey)
	},[onQuick])
	function setDays(d){
		const to = new Date(); const from = new Date(); if (d===0){ from.setHours(0,0,0,0) } else { from.setDate(to.getDate()-d+1); from.setHours(0,0,0,0) }
		onRangeChange?.({ from, to })
	}
	return (
		<div className="flex items-center gap-2">
			<h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
			<div className="ml-auto flex items-center gap-2">
				<div className="rounded-xl border border-line bg-bg-app p-1">
					<button className="rounded-lg px-2 py-1 text-sm" onClick={()=> setDays(0)} aria-label="Today">Oggi</button>
					<button className="rounded-lg px-2 py-1 text-sm" onClick={()=> setDays(7)} aria-label="7d">7g</button>
					<button className="rounded-lg px-2 py-1 text-sm" onClick={()=> setDays(30)} aria-label="30d">30g</button>
				</div>
				<button className="btn" onClick={()=> onQuick?.('new_campaign')}>+ {`Campagna`}</button>
				<button className="rounded-xl border border-line bg-bg-app px-3 py-2 text-sm" onClick={()=> onQuick?.('import')}>{`Importa`}</button>
				<button className="rounded-xl border border-line bg-bg-app px-3 py-2 text-sm" onClick={()=> onQuick?.('schedule')}>{`Schedula`}</button>
			</div>
		</div>
	)
}



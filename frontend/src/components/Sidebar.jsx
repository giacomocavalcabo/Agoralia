import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const groups = [
	{ label: 'Home', items:[{ label:'Dashboard', to:'/' }]},
	{ label: 'Operate', items:[{ label:'Leads', to:'/leads' },{ label:'Campaigns', to:'/campaigns' },{ label:'Calendar', to:'/calendar' }]},
	{ label: 'Analyze', items:[{ label:'Analytics', to:'/analytics' },{ label:'History', to:'/history' }]},
	{ label: 'Data', items:[{ label:'Import', to:'/import' }]},
	{ label: 'Configure', items:[{ label:'Settings', to:'/settings' },{ label:'Billing', to:'/billing' }]},
	{ label: 'Admin', items:[{ label:'Admin', to:'/admin' }]},
]

export default function Sidebar(){
	const { pathname } = useLocation()
	const [collapsed, setCollapsed] = useState(false)
	useEffect(()=> { setCollapsed(localStorage.getItem('sidebar_collapsed') === '1') }, [])
	function toggle(){ const next = !collapsed; setCollapsed(next); localStorage.setItem('sidebar_collapsed', next ? '1' : '0') }
	return (
		<aside className={`border-r border-line py-5 ${collapsed ? 'w-[72px] px-2' : 'w-[240px] px-4'} transition-all duration-150`} aria-label="Primary sidebar">
			<div className="flex items-center justify-between mb-4">
				<div className={`font-extrabold tracking-wide ${collapsed ? 'text-center w-full' : ''}`}>A</div>
				{!collapsed && <button onClick={toggle} className="kpi-title border border-line rounded-lg px-2 py-1 hover:bg-bg-app" aria-label="Collapse sidebar">≪</button>}
				{collapsed && <button onClick={toggle} className="kpi-title border border-line rounded-lg px-2 py-1 hover:bg-bg-app" aria-label="Expand sidebar">≫</button>}
			</div>
			<nav className="grid gap-3" aria-label="Primary">
				{groups.map((g)=> (
					<div key={g.label}>
						{!collapsed && <div className="kpi-title uppercase mb-2">{g.label}</div>}
						<div className="grid gap-1.5">
							{g.items.map((n)=>{
								const active = n.to==='/' ? pathname==='/' : pathname.startsWith(n.to)
								return (
									<Link key={n.to} to={n.to} aria-label={n.label} className={`relative rounded-xl ${collapsed ? 'px-2 py-2 text-center' : 'px-3 py-2'} border ${active ? 'bg-bg-app border-line font-bold' : 'border-transparent hover:bg-bg-app'}`}>
										{active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] bg-brand-600 rounded" aria-hidden/>}
										{collapsed ? n.label.charAt(0) : n.label}
									</Link>
								)
							})}
						</div>
					</div>
				))}
			</nav>
		</aside>
	)
}



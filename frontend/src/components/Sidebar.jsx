import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const baseGroups = [
	{ label: 'Home', items:[{ label:'Dashboard', to:'/' }]},
	{ label: 'Operate', items:[{ label:'Leads', to:'/leads' },{ label:'Campaigns', to:'/campaigns' },{ label:'Calendar', to:'/calendar' },{ label:'Numbers', to:'/numbers' }]},
	{ label: 'Knowledge', items:[{ label:'Knowledge Base', to:'/knowledge' },{ label:'Offer Packs', to:'/knowledge/offers' },{ label:'Imports', to:'/knowledge/imports' },{ label:'Assignments', to:'/knowledge/assignments' }]},
	{ label: 'Analyze', items:[{ label:'Analytics', to:'/analytics' },{ label:'History', to:'/history' }]},
	{ label: 'Configure', items:[{ label:'Settings', to:'/settings' },{ label:'Members', to:'/invite' },{ label:'Billing', to:'/billing' }]},
]

export default function Sidebar(){
	const { pathname } = useLocation()
	const [collapsed, setCollapsed] = useState(false)
	const [isAdmin, setIsAdmin] = useState(false)
	useEffect(()=> {
		setCollapsed(localStorage.getItem('sidebar_collapsed') === '1')
		try{ setIsAdmin(!!localStorage.getItem('admin_email') || !!localStorage.getItem('impersonate_token')) } catch {}
	}, [])
	function toggle(){ const next = !collapsed; setCollapsed(next); localStorage.setItem('sidebar_collapsed', next ? '1' : '0') }
	const groups = [...baseGroups, ...(isAdmin ? [{ label: 'Admin', items:[{ label:'Admin', to:'/admin' }]}] : [])]
	return (
		<aside className={`border-r border-line py-4 ${collapsed ? 'w-[72px] px-2' : 'w-[200px] px-3'} transition-all duration-150 text-xs`} aria-label="Primary sidebar">
			<div className="flex items-center justify-between mb-3">
				<div className={`font-extrabold tracking-wide ${collapsed ? 'text-center w-full' : ''}`}>{collapsed ? 'A' : 'Agoralia'}</div>
				{!collapsed && <button onClick={toggle} className="text-xs border border-line rounded-lg px-1.5 py-0.5 hover:bg-bg-app" aria-label="Collapse sidebar">≪</button>}
				{collapsed && <button onClick={toggle} className="text-xs border border-line rounded-lg px-1.5 py-0.5 hover:bg-bg-app" aria-label="Expand sidebar">≫</button>}
			</div>
			<nav className="grid gap-2" aria-label="Primary">
				{groups.map((g)=> (
					<div key={g.label}>
						{!collapsed && <div className="text-xs uppercase mb-1.5 text-ink-600">{g.label}</div>}
						<div className="grid gap-1">
							{g.items.map((n)=>{
								const active = n.to==='/' ? pathname==='/' : pathname.startsWith(n.to)
								return (
									<Link key={n.to} to={n.to} aria-label={n.label} className={`relative rounded-lg ${collapsed ? 'px-2 py-1.5 text-center' : 'px-2 py-1.5'} border text-xs ${active ? 'bg-bg-app border-line font-semibold' : 'border-transparent hover:bg-bg-app'}`}>
										{active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-brand-600 rounded" aria-hidden/>}
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



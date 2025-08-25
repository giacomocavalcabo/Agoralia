import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

const baseGroups = [
	{ label: 'Home', items:[{ label:'Dashboard', to:'/' }]},
	{ label: 'Operate', items:[
		{ label:'Leads', to:'/leads' },
		{ label:'Campaigns', to:'/campaigns' }, 
		{ label:'Calendar', to:'/calendar' }, 
		{ label:'Numbers', to:'/numbers' }
	]},
	{ label: 'Knowledge', items:[
		{ label:'Overview', to:'/knowledge' }, 
		{ label:'Sources', to:'/knowledge/sources' }, 
		{ label:'Chunks', to:'/knowledge/chunks' }, 
		{ label:'Structure', to:'/knowledge/structure' }, 
		{ label:'Import', to:'/knowledge/import' }, 
		{ label:'Offer Packs', to:'/knowledge/offers' }, 
		{ label:'Imports', to:'/knowledge/imports' }, 
		{ label:'Assignments', to:'/knowledge/assignments' }
	]},
	{ label: 'Analyze', items:[
		{ label:'Analytics', to:'/analytics' }, 
		{ label:'History', to:'/history' }
	]},
	{ label: 'Configure', items:[
		{ label:'Settings', to:'/settings' }, 
		{ label:'Members', to:'/invite' }, 
		{ label:'Billing', to:'/settings/billing' }
	]},
]

export default function Sidebar(){
	const { pathname } = useLocation()
	const { user } = useAuth()
	const [collapsed, setCollapsed] = useState(false)
	const [mounted, setMounted] = useState(false)
	
	useEffect(()=> {
		setMounted(true)
	}, [])
	
	useEffect(()=> {
		if (!mounted) return
		
		setCollapsed(localStorage.getItem('sidebar_collapsed') === '1')
	}, [mounted])
	
	function toggle(){ 
		const next = !collapsed; 
		setCollapsed(next); 
		if (mounted) {
			localStorage.setItem('sidebar_collapsed', next ? '1' : '0') 
		}
	}
	
	// Solo giacomo.cavalcabo14@gmail.com può vedere la sezione Admin
	const isAdmin = user?.email === 'giacomo.cavalcabo14@gmail.com'
	const groups = [...baseGroups, ...(isAdmin ? [{ label: 'Admin', items:[{ label:'Admin', to:'/admin' }]}] : [])]
	
	return (
		<aside className={`border-r border-line py-4 ${collapsed ? 'w-[72px] px-2' : 'w-[200px] px-3'} transition-all duration-150 text-xs`} aria-label="Primary sidebar">
			<div className="flex items-center justify-between mb-3">
				<div className={`font-extrabold tracking-wide ${collapsed ? 'text-center w-full' : ''}`}>
					{collapsed ? 'A' : 'Agoralia'}
				</div>
				{!collapsed && (
					<button onClick={toggle} className="text-xs border border-line rounded-lg px-1.5 py-0.5 hover:bg-bg-app" aria-label="Collapse sidebar">
						≪
					</button>
				)}
				{collapsed && (
					<button onClick={toggle} className="text-xs border border-line rounded-lg px-1.5 py-0.5 hover:bg-bg-app" aria-label="Expand sidebar">
						≫
					</button>
				)}
			</div>
			
			<nav className="grid gap-2" aria-label="Primary">
				{groups.map((g)=> (
					<div key={g.label}>
						{!collapsed && (
							<div className="text-xs uppercase mb-1.5 text-ink-600">
								{g.label}
							</div>
						)}
						<div className="grid gap-1">
							{g.items.map((n)=>{
								const active = n.to==='/' ? pathname==='/' : pathname.startsWith(n.to)
								return (
									<Link 
										key={n.to} 
										to={n.to} 
										aria-label={n.label} 
										title={n.label}
										className={`relative rounded-lg ${collapsed ? 'px-2 py-1.5 text-center' : 'px-2 py-1.5'} border text-xs ${
											active ? 'bg-bg-app border-line font-semibold' : 'border-transparent hover:bg-bg-app'
										}`}
									>
										{active && (
											<span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-brand-600 rounded" aria-hidden/>
										)}
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



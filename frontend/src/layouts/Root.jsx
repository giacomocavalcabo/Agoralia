import { Link, Outlet, useLocation } from 'react-router-dom'
import UsageBar from '../components/UsageBar.jsx'

const groups = [
	{ label: 'Home', items:[{ label:'Dashboard', to:'/' }]},
	{ label: 'Operate', items:[{ label:'Leads', to:'/leads' },{ label:'Campaigns', to:'/campaigns' },{ label:'Calendar', to:'/calendar' }]},
	{ label: 'Analyze', items:[{ label:'Analytics', to:'/analytics' },{ label:'History', to:'/history' }]},
	{ label: 'Data', items:[{ label:'Import', to:'/import' }]},
	{ label: 'Configure', items:[{ label:'Settings', to:'/settings' },{ label:'Billing', to:'/billing' }]},
	{ label: 'Admin', items:[{ label:'Admin', to:'/admin' }]},
]

function currentTitle(pathname){
	for (const g of groups){
		for (const it of g.items){ if ((it.to==='/' && pathname==='/' ) || (it.to!=='/' && pathname.startsWith(it.to))) return it.label }
	}
	return 'Agoralia'
}

export default function Root() {
	const { pathname } = useLocation()
	return (
		<div style={{ display:'grid', gridTemplateColumns:'240px 1fr', minHeight:'100vh' }}>
			<aside style={{ borderRight:'1px solid var(--border)', padding:20 }}>
				<div style={{ fontWeight:800, letterSpacing:.4, marginBottom:18 }}>Agoralia</div>
				<nav style={{ display:'grid', gap:14 }} aria-label="Primary">
					{groups.map((g)=> (
						<div key={g.label}>
							<div className="kpi-title" style={{ textTransform:'uppercase', marginBottom:8 }}>{g.label}</div>
							<div style={{ display:'grid', gap:6 }}>
								{g.items.map((n)=>{
									const active = n.to==='/' ? pathname==='/' : pathname.startsWith(n.to)
									return (
										<Link key={n.to} to={n.to} style={{
											padding:'10px 12px', borderRadius:10,
											background: active ? 'var(--surface)' : 'transparent',
											border: active ? '1px solid var(--border)' : '1px solid transparent',
											fontWeight: active ? 700 : 500
										}}>{n.label}</Link>
									)
								})}
							</div>
						</div>
					))}
				</nav>
			</aside>
			<section>
				<header style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
					<h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>{currentTitle(pathname)}</h2>
					<div style={{ marginLeft:'auto' }}><UsageBar /></div>
				</header>
				<div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
					<Outlet />
				</div>
			</section>
		</div>
	)
}

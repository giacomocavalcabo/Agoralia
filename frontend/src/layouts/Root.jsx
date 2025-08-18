import { Outlet } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import Sidebar from '../components/Sidebar.jsx'
import CreateDrawer from '../components/CreateDrawer.jsx'

export default function Root() {
	const imp = (()=>{ try { return JSON.parse(localStorage.getItem('impersonate_user')||'null') } catch { return null } })()
	return (
		<div className="grid" style={{ gridTemplateColumns:'auto 1fr', minHeight:'100vh' }}>
			<Sidebar />
			<section>
				<AppHeader />
				<CreateDrawer />
				{imp && (
					<div style={{ padding:'8px 20px', background:'#FEF3C7', borderBottom:'1px solid #FDE68A', display:'flex', alignItems:'center', gap:12 }}>
						<span style={{ fontWeight:700 }}>Impersonating {imp.email || imp.name || imp.id}</span>
						<button className="btn" onClick={()=>{ localStorage.removeItem('impersonate_token'); localStorage.removeItem('impersonate_user'); location.reload() }}>Return</button>
					</div>
				)}
				<div className="mx-auto max-w-screen-2xl px-6 py-8">
					<Outlet />
				</div>
			</section>
		</div>
	)
}

import { Outlet } from 'react-router-dom'
import AppShell from '../components/AppShell.jsx'
import CreateDrawer from '../components/CreateDrawer.jsx'

export default function Root() {
	const imp = (()=>{ try { return JSON.parse(localStorage.getItem('impersonate_user')||'null') } catch { return null } })()
	
	return (
		<AppShell>
			{imp && (
				<div style={{ padding:'8px 20px', background:'#FEF3C7', borderBottom:'1px solid #FDE68A', display:'flex', alignItems:'center', gap:12 }}>
					<span style={{ fontWeight:700 }}>Impersonating {imp.email || imp.name || imp.id}</span>
					<button className="btn" onClick={()=>{ localStorage.removeItem('impersonate_token'); localStorage.removeItem('impersonate_user'); location.reload() }}>Return</button>
				</div>
			)}
			<CreateDrawer />
			<Outlet />
		</AppShell>
	)
}

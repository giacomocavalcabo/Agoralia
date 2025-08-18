import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'

export default function Admin() {
	const { t } = useI18n()
	const { toast } = useToast()
	const [tab, setTab] = useState('dashboard')
	const [services, setServices] = useState([])
	const [users, setUsers] = useState([])
	const [workspaces, setWorkspaces] = useState([])
	const [billing, setBilling] = useState(null)
	const [usage, setUsage] = useState(null)
	const [qUsers, setQUsers] = useState('')
	const [attestations, setAttestations] = useState([])
	const [calls, setCalls] = useState([])
	const [notif, setNotif] = useState({ kind:'email', locale:'en-US', subject:'', body_md:'' })
	const [error, setError] = useState('')
	const [adminEmail, setAdminEmail] = useState(typeof window!=='undefined' ? (localStorage.getItem('admin_email') || '') : '')

	const api = useMemo(()=> import.meta.env.VITE_API_BASE_URL, [])
	const headers = useMemo(()=> ({ 'X-Admin-Email': adminEmail }), [adminEmail])
	function withAdmin(url){
		const u = new URL(url)
		if (adminEmail) u.searchParams.set('admin_email', adminEmail)
		return u.toString()
	}

	async function loadHealth(){
		setError('')
		try {
			const res = await fetch(withAdmin(`${api}/admin/health`), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setServices(j.services || [])
		} catch(e){ setError('Admin required or network error') }
	}

	async function loadUsers(){
		try {
			const u = new URL(withAdmin(`${api}/admin/users`))
			if (qUsers) u.searchParams.set('query', qUsers)
			const res = await fetch(u.toString(), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setUsers(j.items || [])
		} catch(e){ setUsers([]); setError('Admin required or network error') }
	}

	async function loadWorkspaces(){
		try {
			const res = await fetch(withAdmin(`${api}/admin/workspaces`), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setWorkspaces(j.items || [])
		} catch(e){ setWorkspaces([]); setError('Admin required or network error') }
	}

	async function loadCompliance(){
		try {
			const res = await fetch(withAdmin(`${api}/admin/compliance/attestations`), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setAttestations(j.items || [])
		} catch(e){ setAttestations([]) }
	}

	async function loadCalls(){
		try {
			const res = await fetch(withAdmin(`${api}/admin/calls/live`), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setCalls(j.items || [])
		} catch(e){ setCalls([]) }
	}

	function ym(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
	async function loadKpi(){
		try {
			const [b,u] = await Promise.all([
				fetch(withAdmin(`${api}/admin/billing/overview?period=${ym()}`), { headers }),
				fetch(withAdmin(`${api}/admin/usage/overview?period=${ym()}`), { headers })
			])
			if (b.ok) setBilling(await b.json()); else setBilling(null)
			if (u.ok) setUsage(await u.json()); else setUsage(null)
		} catch { setBilling(null); setUsage(null) }
	}

	useEffect(()=>{ if(adminEmail){ loadHealth(); loadKpi() } },[adminEmail])
	useEffect(()=>{ if(adminEmail && tab==='users') loadUsers() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='workspaces') loadWorkspaces() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='compliance') loadCompliance() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='calls') loadCalls() },[adminEmail, tab])

	async function impersonate(u){
		try {
			const res = await fetch(withAdmin(`${api}/admin/users/${u.id}/impersonate`), { method:'POST', headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			localStorage.setItem('impersonate_token', j.token)
			localStorage.setItem('impersonate_user', JSON.stringify({ id: u.id, email: u.email, name: u.name, expires_at: j.expires_at }))
			toast(t('admin.notices.impersonating', { user: u.email || u.name || u.id }))
		} catch(e){ toast('Failed to impersonate') }
	}

	return (
		<div>
			<h1>Admin</h1>
			<div className="panel" style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
				<input className="input" placeholder="Admin email" value={adminEmail} onChange={(e)=> { setAdminEmail(e.target.value); localStorage.setItem('admin_email', e.target.value) }} onKeyDown={(e)=> { if(e.key==='Enter'){ loadHealth(); if(tab==='users') loadUsers(); if(tab==='workspaces') loadWorkspaces(); if(tab==='calls') loadCalls(); if(tab==='compliance') loadCompliance(); loadKpi() } }} />
				<button className="btn" onClick={()=>{ loadHealth(); loadUsers(); loadWorkspaces(); loadCalls(); loadCompliance(); loadKpi() }}>Load</button>
				{error && <span className="kpi-title" style={{ color:'#b91c1c' }}>{error}</span>}
			</div>

			<div className="panel" style={{ display:'flex', gap:8, marginBottom:12 }}>
				{['dashboard','users','workspaces','calls','compliance','notifications'].map((k)=> (
					<button
						key={k}
						className="btn"
						onClick={()=> setTab(k)}
						style={{
							color: '#111827',
							background: tab===k ? 'var(--surface)' : 'transparent',
							borderColor: 'var(--border)',
							fontWeight: tab===k ? 700 : 600,
						}}
					>
						{k.charAt(0).toUpperCase()+k.slice(1)}
					</button>
				))}
			</div>

			{tab==='dashboard' && (
				<div style={{ display:'grid', gap:12 }}>
					<div className="panel" style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12 }}>
						<div className="card"><div className="kpi-title">MRR</div><div className="kpi-value">{billing?.mrr_cents ? `€${(billing.mrr_cents/100).toFixed(2)}` : '—'}</div></div>
						<div className="card"><div className="kpi-title">ARR</div><div className="kpi-value">{billing?.arr_cents ? `€${(billing.arr_cents/100).toFixed(2)}` : '—'}</div></div>
						<div className="card"><div className="kpi-title">Minutes MTD</div><div className="kpi-value">{usage?.by_lang?.reduce((a,x)=> a+x.minutes, 0) ?? 0}</div></div>
						<div className="card"><div className="kpi-title">Countries</div><div className="kpi-value">{usage?.by_country?.length ?? 0}</div></div>
					</div>
					<div className="panel" style={{ display:'grid', gap:8 }}>
						<div className="kpi-title" style={{ textTransform:'uppercase' }}>{t('pages.dashboard.health.title')}</div>
						{services.map((s,i)=> (
							<div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
								<span style={{ width:8, height:8, borderRadius:999, background: s.status==='ok' ? '#10b981' : s.status==='warn' ? '#f59e0b' : '#ef4444' }} />
								<span>{s.name}</span>
							</div>
						))}
						{!services.length && <div className="kpi-title">No data</div>}
					</div>
				</div>
			)}

			{tab==='users' && (
				<div className="panel" style={{ display:'grid', gap:12 }}>
					<div style={{ display:'flex', gap:8 }}>
						<input className="input" placeholder={t('admin.users.search_placeholder')} value={qUsers} onChange={(e)=> setQUsers(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && loadUsers()} />
						<button className="btn" onClick={loadUsers}>Search</button>
					</div>
					<div style={{ overflowX:'auto' }}>
						<table className="table">
							<thead>
								<tr>
									<th>Name/Email</th><th>Locale/TZ</th><th>Workspaces</th><th>Status</th><th>Global</th><th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{users.map((u)=> (
									<tr key={u.id}>
										<td><div className="kpi-title">{u.name || u.email}</div><div className="muted">{u.email}</div></td>
										<td>{u.locale} / {u.tz}</td>
										<td>{(u.workspaces || []).join(', ')}</td>
										<td>{u.status}</td>
										<td>{u.is_admin_global ? 'yes' : 'no'}</td>
										<td>
											<button className="btn" onClick={()=> impersonate(u)}>{t('admin.users.impersonate')}</button>
											<button className="btn" onClick={async ()=>{ try{ await fetch(`${api}/admin/users/${u.id}`, { method:'PATCH', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ status: u.status==='active'?'suspended':'active' }) }); toast(u.status==='active'?'Suspended':'Unsuspended'); loadUsers() } catch{} }}>Toggle</button>
										</td>
									</tr>
								))}
								{!users.length && (
									<tr><td colSpan={5} className="muted">No users</td></tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{tab==='workspaces' && (
				<div className="panel" style={{ overflowX:'auto' }}>
					<table className="table">
						<thead>
							<tr>
								<th>Name</th><th>Plan</th><th>Concurrency</th><th>Members</th><th>Minutes MTD</th><th>Spend MTD</th>
							</tr>
						</thead>
						<tbody>
							{workspaces.map((w)=> (
								<tr key={w.id}>
									<td className="kpi-title">{w.name}</td>
									<td>{w.plan}</td>
									<td>{w.concurrency_limit}</td>
									<td>{w.members}</td>
									<td>{w.minutes_mtd ?? 0}</td>
									<td>{w.spend_mtd_cents ? `€${(w.spend_mtd_cents/100).toFixed(2)}` : '—'}</td>
								</tr>
							))}
							{!workspaces.length && (
								<tr><td colSpan={6} className="muted">No workspaces</td></tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			{tab==='calls' && (
				<div className="panel" style={{ overflowX:'auto' }}>
					<table className="table">
						<thead><tr><th>ID</th><th>Workspace</th><th>Lang</th><th>ISO</th><th>Status</th><th>Duration</th></tr></thead>
						<tbody>
							{calls.map((c)=> (
								<tr key={c.id}><td>{c.id}</td><td>{c.workspace_id}</td><td>{c.lang}</td><td>{c.iso}</td><td>{c.status}</td><td>{c.duration_s || 0}s</td></tr>
							))}
							{!calls.length && <tr><td colSpan={6} className="muted">No calls</td></tr>}
						</tbody>
					</table>
				</div>
			)}

			{tab==='compliance' && (
				<div className="panel" style={{ overflowX:'auto' }}>
					<table className="table">
						<thead><tr><th>ID</th><th>Workspace</th><th>Campaign</th><th>ISO</th><th>Version</th><th>Signed</th></tr></thead>
						<tbody>
							{attestations.map((a)=> (
								<tr key={a.id}><td>{a.id}</td><td>{a.workspace_id}</td><td>{a.campaign_id||'—'}</td><td>{a.iso}</td><td>{a.notice_version}</td><td>{a.signed_at}</td></tr>
							))}
							{!attestations.length && <tr><td colSpan={6} className="muted">No attestations</td></tr>}
						</tbody>
					</table>
				</div>
			)}

			{tab==='notifications' && (
				<div className="panel" style={{ display:'grid', gap:12 }}>
					<div className="kpi-title">Notifications</div>
					<div style={{ display:'grid', gap:8 }}>
						<input className="input" placeholder="Subject" value={notif.subject} onChange={e=> setNotif({ ...notif, subject:e.target.value })} />
						<textarea className="input" placeholder="Body (Markdown)" rows={6} value={notif.body_md} onChange={e=> setNotif({ ...notif, body_md:e.target.value })} />
						<div style={{ display:'flex', gap:8 }}>
							<button className="btn" onClick={async ()=>{ try{ const r = await fetch(`${api}/admin/notifications/preview`, { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(notif) }); const j = await r.json(); toast('Preview ready'); window.open('data:text/html;charset=utf-8,'+encodeURIComponent(j.html),'_blank') } catch{} }}>Preview</button>
							<button className="btn" onClick={async ()=>{ try{ const r = await fetch(`${api}/admin/notifications/send`, { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(notif) }); const j = await r.json(); toast('Queued '+j.id) } catch{} }}>Send</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}



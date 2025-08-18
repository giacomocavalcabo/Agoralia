import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import Modal from '../components/Modal.jsx'
import Drawer from '../components/Drawer.jsx'
import KpiTile from '../components/ui/KpiTile.jsx'

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
	const [callsMode, setCallsMode] = useState('live')
	const [callsHistory, setCallsHistory] = useState([])
	const [callsFilters, setCallsFilters] = useState({ q:'', iso:'', lang:'' })
	const [notif, setNotif] = useState({ kind:'email', locale:'en-US', subject:'', body_md:'' })
	const [error, setError] = useState('')
	const [adminEmail, setAdminEmail] = useState(typeof window!=='undefined' ? (localStorage.getItem('admin_email') || '') : '')
	const [activity, setActivity] = useState([])
	const [wsBilling, setWsBilling] = useState(null)
	const [wsId, setWsId] = useState('ws_1')
	const [campaigns, setCampaigns] = useState([])
	const [q, setQ] = useState('')
	const [search, setSearch] = useState(null)
	const [genOpen, setGenOpen] = useState(false)
	const [genForm, setGenForm] = useState({ workspace_id:'ws_1', campaign_id:'', iso:'IT', inputs:'{"notice":"demo"}' })
	const [userOpen, setUserOpen] = useState(false)
	const [userForm, setUserForm] = useState(null)
	const [wsOpen, setWsOpen] = useState(false)
	const [wsForm, setWsForm] = useState(null)
	const [preflight, setPreflight] = useState([])
	const [templates, setTemplates] = useState([])
	const [callOpen, setCallOpen] = useState(false)
	const [callDetail, setCallDetail] = useState(null)
	const [segments, setSegments] = useState({ plan:'', country:'', inactiveDays:'', lang:'' })

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
			const p = await fetch(withAdmin(`${api}/admin/compliance/preflight/logs`), { headers }).then(r=> r.ok ? r.json() : { items:[] })
			setPreflight(p.items||[])
			const t = await fetch(withAdmin(`${api}/admin/compliance/templates`), { headers }).then(r=> r.ok ? r.json() : { items:[] })
			setTemplates(t.items||[])
		} catch(e){ setAttestations([]); setPreflight([]); setTemplates([]) }
	}

	async function loadCalls(){
		try {
			const res = await fetch(withAdmin(`${api}/admin/calls/live`), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setCalls(j.items || [])
		} catch(e){ setCalls([]) }
	}

	async function loadCallsSearch(){
		try {
			const u = new URL(withAdmin(`${api}/admin/calls/search`))
			if (callsFilters.q) u.searchParams.set('query', callsFilters.q)
			if (callsFilters.iso) u.searchParams.set('iso', callsFilters.iso)
			if (callsFilters.lang) u.searchParams.set('lang', callsFilters.lang)
			const res = await fetch(u.toString(), { headers })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setCallsHistory(j.items || [])
		} catch(e){ setCallsHistory([]) }
	}

	async function openCall(c){
		try{ const r = await fetch(withAdmin(`${api}/admin/calls/${c.id}`), { headers }); const j = await r.json(); setCallDetail(j); setCallOpen(true) } catch{}
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

	async function loadActivity(){
		try{ const r = await fetch(withAdmin(`${api}/admin/activity?limit=100`), { headers }); const j = await r.json(); setActivity(j.items||[]) } catch{ setActivity([]) }
	}

	async function loadWsBilling(){
		try{ const r = await fetch(withAdmin(`${api}/admin/workspaces/${wsId}/billing`), { headers }); const j = await r.json(); setWsBilling(j) } catch{ setWsBilling(null) }
	}

	async function loadCampaigns(){
		try{ const r = await fetch(withAdmin(`${api}/admin/campaigns`), { headers }); const j = await r.json(); setCampaigns(j.items||[]) } catch{ setCampaigns([]) }
	}

	async function runSearch(){
		if (!q) { setSearch(null); return }
		try{ const r = await fetch(withAdmin(`${api}/admin/search?q=${encodeURIComponent(q)}`), { headers }); const j = await r.json(); setSearch(j) } catch{ setSearch({ users:[], workspaces:[], calls:[], campaigns:[] }) }
	}

	// Auto-run search if q param present (from global header input)
	useEffect(()=>{
		try{
			const urlQ = new URL(window.location.href).searchParams.get('q')
			if (urlQ){ setTab('admin'); setQ(urlQ); runSearch() }
		}catch{}
	},[])

	async function generatePdf(){
		try {
			let inputs
			try { inputs = JSON.parse(genForm.inputs || '{}') } catch { inputs = {} }
			const res = await fetch(withAdmin(`${api}/admin/compliance/attestations/generate`), {
				method:'POST',
				headers: { ...headers, 'Content-Type':'application/json' },
				body: JSON.stringify({ workspace_id: genForm.workspace_id, campaign_id: genForm.campaign_id || null, iso: genForm.iso, inputs }),
			})
			if (!res.ok) throw new Error('Generate failed')
			const j = await res.json()
			toast('PDF generated')
			setGenOpen(false)
			loadCompliance()
			if (j.pdf_url) window.open(j.pdf_url, '_blank')
		} catch(e){ toast('Failed to generate') }
	}

	async function openUser(u){
		try{ const r = await fetch(withAdmin(`${api}/admin/users/${u.id}`), { headers }); const j = await r.json(); setUserForm(j); setUserOpen(true) } catch{}
	}

	async function saveUser(){
		try{ await fetch(withAdmin(`${api}/admin/users/${userForm.id}`), { method:'PATCH', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ locale:userForm.locale, tz:userForm.tz, status:userForm.status })}); toast('User updated'); setUserOpen(false); loadUsers() } catch{ toast('Save failed') }
	}

	async function openWorkspace(w){
		try{ const r = await fetch(withAdmin(`${api}/admin/workspaces/${w.id}`), { headers }); const j = await r.json(); setWsForm({ id:j.id, plan_id:j.plan, concurrency_limit: (typeof j.concurrency_limit==='number'? j.concurrency_limit : 10), suspended: !!j.suspended }); setWsOpen(true) } catch{}
	}

	async function saveWorkspace(){
		try{ await fetch(withAdmin(`${api}/admin/workspaces/${wsForm.id}`), { method:'PATCH', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(wsForm) }); toast('Workspace updated'); setWsOpen(false); loadWorkspaces() } catch{ toast('Save failed') }
	}

	useEffect(()=>{ if(adminEmail){ loadHealth(); loadKpi() } },[adminEmail])
	useEffect(()=>{ if(adminEmail && tab==='users') loadUsers() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='workspaces') loadWorkspaces() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='compliance') loadCompliance() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='calls' && callsMode==='live') loadCalls() },[adminEmail, tab, callsMode])
	useEffect(()=>{ if(adminEmail && tab==='calls' && callsMode==='history') loadCallsSearch() },[adminEmail, tab, callsMode])
	useEffect(()=>{ if(adminEmail && tab==='logs') loadActivity() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='billing') loadWsBilling() },[adminEmail, tab, wsId])
	useEffect(()=>{ if(adminEmail && tab==='campaigns') loadCampaigns() },[adminEmail, tab])
	useEffect(()=>{ if(adminEmail && tab==='dashboard'){ loadUsers(); loadWorkspaces(); loadCalls() } },[adminEmail, tab])

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
		<div className="grid gap-3">
			<div className="panel flex items-center gap-2">
				<input className="input" placeholder="Admin email" value={adminEmail} onChange={(e)=> { setAdminEmail(e.target.value); localStorage.setItem('admin_email', e.target.value) }} onKeyDown={(e)=> { if(e.key==='Enter'){ loadHealth(); if(tab==='users') loadUsers(); if(tab==='workspaces') loadWorkspaces(); if(tab==='calls') loadCalls(); if(tab==='compliance') loadCompliance(); loadKpi() } }} />
				<button className="btn" onClick={()=>{ loadHealth(); loadUsers(); loadWorkspaces(); loadCalls(); loadCompliance(); loadKpi(); if(tab==='campaigns') loadCampaigns() }}>Load</button>
				<input className="input flex-1" placeholder="Search…" value={q} onChange={(e)=> setQ(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && runSearch()} />
				<button className="btn" onClick={runSearch}>Search</button>
				{error && <span className="kpi-title text-danger">{error}</span>}
			</div>

			<div className="panel flex flex-wrap gap-2">
				{['dashboard','users','workspaces','calls','campaigns','compliance','notifications','billing','logs'].map((k)=> (
					<button
						key={k}
						onClick={()=> setTab(k)}
						className={`rounded-lg border border-line px-2.5 py-1.5 ${tab===k? 'bg-bg-app font-semibold' : ''}`}
					>
						{k.charAt(0).toUpperCase()+k.slice(1)}
					</button>
				))}
			</div>

			{tab==='dashboard' && (
				<div className="grid gap-4">
					<div className="grid grid-cols-12 gap-4">
						<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Users total" value={users.length || '—'} /></div>
						<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Active 7d" value={'—'} /></div>
						<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="MRR" value={billing?.mrr_cents ? `€${(billing.mrr_cents/100).toFixed(2)}` : '—'} /></div>
						<div className="col-span-12 sm:col-span-6 xl:col-span-3"><KpiTile label="Minutes MTD" value={usage?.by_lang?.reduce((a,x)=> a+x.minutes, 0) ?? 0} /></div>
					</div>

					<div className="grid grid-cols-12 gap-4">
						<div className="col-span-12 xl:col-span-7 panel">
							<div className="kpi-title mb-2">{t('pages.dashboard.health.title')}</div>
							<div className="grid gap-2">
								{services.map((s,i)=> (
									<div key={i} className="flex items-center gap-2">
										<span className={`h-2 w-2 rounded-full ${s.status==='ok' ? 'bg-success' : s.status==='warn' ? 'bg-warn' : 'bg-danger'}`} />
										<span className="text-sm">{s.name}</span>
									</div>
								))}
								{!services.length && <div className="kpi-title">No data</div>}
							</div>
						</div>
						<div className="col-span-12 xl:col-span-5 panel overflow-auto">
							<div className="kpi-title mb-2">Live calls</div>
							<table className="w-full border-separate text-sm" style={{ borderSpacing:0 }}>
								<thead><tr><th className="kpi-title text-left px-3 py-2">ID</th><th className="kpi-title text-left px-3 py-2">Lang</th><th className="kpi-title text-left px-3 py-2">ISO</th><th className="kpi-title text-left px-3 py-2">Status</th></tr></thead>
								<tbody>
									{calls.map((c)=> (<tr key={c.id}><td className="px-3 py-2">{c.id}</td><td className="px-3 py-2">{c.lang}</td><td className="px-3 py-2">{c.iso}</td><td className="px-3 py-2">{c.status}</td></tr>))}
									{!calls.length && <tr><td colSpan={4} className="kpi-title px-3 py-2">No live calls</td></tr>}
								</tbody>
							</table>
						</div>
					</div>

					<div className="grid grid-cols-12 gap-4">
						<div className="col-span-12 xl:col-span-7 panel">
							<div className="kpi-title mb-2">Top workspaces</div>
							<ul className="m-0 pl-4">
								{[...workspaces].sort((a,b)=> (b.minutes_mtd||0)-(a.minutes_mtd||0)).slice(0,5).map((w)=> (<li key={w.id} className="kpi-title">{w.name} — {w.minutes_mtd||0} min • {w.spend_mtd_cents? `€${(w.spend_mtd_cents/100).toFixed(2)}`:'—'}</li>))}
								{!workspaces.length && <li className="kpi-title">No workspaces</li>}
							</ul>
						</div>
						<div className="col-span-12 xl:col-span-5 panel">
							<div className="kpi-title mb-2">Quick admin actions</div>
							<div className="flex flex-wrap gap-2">
								<button className="btn" onClick={()=> setTab('notifications')}>Send notice</button>
								<button className="rounded-xl border border-line bg-bg-app px-3 py-2" onClick={()=> setTab('billing')}>Add credits</button>
								<button className="rounded-xl border border-line bg-bg-app px-3 py-2" onClick={()=> setTab('compliance')}>Open compliance logs</button>
							</div>
						</div>
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
											<button className="btn" onClick={()=> openUser(u)}>View</button>
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
									<td><button className="btn" onClick={()=> openWorkspace(w)}>View</button></td>
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
					<div style={{ display:'flex', gap:8, marginBottom:8 }}>
						<button className="btn" onClick={()=> setCallsMode('live')} style={{ fontWeight: callsMode==='live'?700:600 }}>Live</button>
						<button className="btn" onClick={()=> setCallsMode('history')} style={{ fontWeight: callsMode==='history'?700:600 }}>History</button>
						{callsMode==='history' && (
							<>
								<input className="input" placeholder="Query" value={callsFilters.q} onChange={(e)=> setCallsFilters({ ...callsFilters, q:e.target.value })} />
								<input className="input" placeholder="ISO" value={callsFilters.iso} onChange={(e)=> setCallsFilters({ ...callsFilters, iso:e.target.value })} style={{ maxWidth:100 }} />
								<input className="input" placeholder="Lang" value={callsFilters.lang} onChange={(e)=> setCallsFilters({ ...callsFilters, lang:e.target.value })} style={{ maxWidth:120 }} />
								<button className="btn" onClick={loadCallsSearch}>Search</button>
							</>
						)}
					</div>
					<table className="table">
						<thead><tr><th>ID</th><th>Workspace</th><th>Lang</th><th>ISO</th><th>Status</th><th>Duration</th></tr></thead>
						<tbody>
							{(callsMode==='live'? calls : callsHistory).map((c)=> (
								<tr key={c.id}><td><button className="btn" onClick={()=> openCall(c)}>{c.id}</button></td><td>{c.workspace_id}</td><td>{c.lang}</td><td>{c.iso}</td><td>{c.status}</td><td>{c.duration_s || 0}s</td></tr>
							))}
							{(callsMode==='live'? !calls.length : !callsHistory.length) && <tr><td colSpan={6} className="muted">No calls</td></tr>}
						</tbody>
					</table>
				</div>
			)}

			{tab==='campaigns' && (
				<div className="panel" style={{ overflowX:'auto' }}>
					<table className="table">
						<thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Pacing</th><th>Budget cap</th><th>Actions</th></tr></thead>
						<tbody>
							{campaigns.map((c)=> (
								<tr key={c.id}>
									<td>{c.id}</td><td>{c.name}</td><td>{c.status}</td><td>{c.pacing_npm}</td><td>{c.budget_cap_cents}</td>
									<td>
										{c.status==='running' ? (
											<button className="btn" onClick={async ()=>{ try{ await fetch(withAdmin(`${api}/admin/campaigns/${c.id}/pause`), { method:'POST', headers }); await loadCampaigns() } catch{} }}>Pause</button>
										) : (
											<button className="btn" onClick={async ()=>{ try{ await fetch(withAdmin(`${api}/admin/campaigns/${c.id}/resume`), { method:'POST', headers }); await loadCampaigns() } catch{} }}>Resume</button>
										)}
									</td>
								</tr>
							))}
							{!campaigns.length && <tr><td colSpan={6} className="muted">No campaigns</td></tr>}
						</tbody>
					</table>
				</div>
			)}

			{/* Call detail drawer */}
			<Drawer open={callOpen} onClose={()=> setCallOpen(false)} title={callDetail ? (`Call ${callDetail.id}`) : 'Call'}>
				{callDetail && (
					<div style={{ display:'grid', gap:8 }}>
						<div className="kpi-title">Lang/ISO: {callDetail.lang} / {callDetail.iso}</div>
						<div className="kpi-title">Provider: {callDetail.provider}</div>
						<div className="kpi-title">Duration: {callDetail.duration_s||0}s • Cost: €{(callDetail.cost_cents||0)/100}</div>
						<div style={{ display:'flex', gap:8 }}>
							<button className="btn" onClick={()=> setCallOpen(false)}>Close</button>
							<button className="btn" onClick={()=> toast('Export queued')}>Export audio</button>
							<button className="btn" onClick={()=> toast('Flagged for QA')}>Flag QA</button>
						</div>
					</div>
				)}
			</Drawer>

			{tab==='compliance' && (
				<div className="panel" style={{ overflowX:'auto' }}>
					<div style={{ display:'flex', gap:8, marginBottom:8 }}>
						<button className="btn" onClick={()=> setGenOpen(true)}>Generate PDF</button>
					</div>
					<table className="table">
						<thead><tr><th>ID</th><th>Workspace</th><th>Campaign</th><th>ISO</th><th>Version</th><th>Signed</th></tr></thead>
						<tbody>
							{attestations.map((a)=> (
								<tr key={a.id}><td>{a.id}</td><td>{a.workspace_id}</td><td>{a.campaign_id||'—'}</td><td>{a.iso}</td><td>{a.notice_version}</td><td>{a.signed_at}</td></tr>
							))}
							{!attestations.length && <tr><td colSpan={6} className="muted">No attestations</td></tr>}
						</tbody>
					</table>

					<div className="panel" style={{ marginTop:12 }}>
						<div className="kpi-title" style={{ marginBottom:8 }}>Pre-flight logs</div>
						<ul style={{ margin:0, paddingLeft:16 }}>
							{preflight.map((p)=> (<li key={p.id} className="kpi-title">[{p.created_at}] {p.iso} {p.decision} {p.reasons?.join(',')||''}</li>))}
							{!preflight.length && <li className="kpi-title">No logs</li>}
						</ul>
					</div>

					<div className="panel" style={{ marginTop:12 }}>
						<div className="kpi-title" style={{ marginBottom:8 }}>Legal templates</div>
						<table className="table">
							<thead><tr><th>ISO</th><th>Lang</th><th>Disclosure</th><th>Recording</th><th>Version</th></tr></thead>
							<tbody>
								{templates.map((t,i)=> (<tr key={i}><td>{t.iso}</td><td>{t.lang}</td><td className="muted">{t.disclosure}</td><td className="muted">{t.recording}</td><td>{t.version}</td></tr>))}
								{!templates.length && <tr><td colSpan={5} className="muted">No templates</td></tr>}
							</tbody>
						</table>
					</div>

					<Modal title="Generate compliance PDF" open={genOpen} onClose={()=> setGenOpen(false)} footer={[
						<button key="cancel" className="btn" onClick={()=> setGenOpen(false)}>Cancel</button>,
						<button key="gen" className="btn" onClick={generatePdf}>Generate</button>
					]}>
						<div style={{ display:'grid', gap:8 }}>
							<label className="kpi-title">Workspace ID</label>
							<input className="input" value={genForm.workspace_id} onChange={(e)=> setGenForm({ ...genForm, workspace_id: e.target.value })} />
							<label className="kpi-title">Campaign ID (optional)</label>
							<input className="input" value={genForm.campaign_id} onChange={(e)=> setGenForm({ ...genForm, campaign_id: e.target.value })} />
							<label className="kpi-title">ISO</label>
							<input className="input" value={genForm.iso} onChange={(e)=> setGenForm({ ...genForm, iso: e.target.value })} />
							<label className="kpi-title">Inputs (JSON)</label>
							<textarea className="input" rows={6} value={genForm.inputs} onChange={(e)=> setGenForm({ ...genForm, inputs: e.target.value })} />
						</div>
					</Modal>
				</div>
			)}

			{tab==='notifications' && (
				<div className="panel" style={{ display:'grid', gap:12 }}>
					<div className="kpi-title">Notifications</div>
					<div style={{ display:'grid', gap:8 }}>
						<div className="kpi-title">Segment (minimo)</div>
						<div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
							<input className="input" placeholder="Plan (e.g. core)" value={segments.plan} onChange={(e)=> setSegments({ ...segments, plan:e.target.value })} />
							<input className="input" placeholder="Country ISO" value={segments.country} onChange={(e)=> setSegments({ ...segments, country:e.target.value })} style={{ maxWidth:120 }} />
							<input className="input" placeholder="Inactive days > N" value={segments.inactiveDays} onChange={(e)=> setSegments({ ...segments, inactiveDays:e.target.value })} style={{ maxWidth:160 }} />
							<input className="input" placeholder="Lang" value={segments.lang} onChange={(e)=> setSegments({ ...segments, lang:e.target.value })} style={{ maxWidth:120 }} />
						</div>
						<input className="input" placeholder="Subject" value={notif.subject} onChange={e=> setNotif({ ...notif, subject:e.target.value })} />
						<textarea className="input" placeholder="Body (Markdown)" rows={6} value={notif.body_md} onChange={e=> setNotif({ ...notif, body_md:e.target.value })} />
						<div style={{ display:'flex', gap:8 }}>
							<button className="btn" onClick={async ()=>{ try{ const r = await fetch(`${api}/admin/notifications/preview`, { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(notif) }); const j = await r.json(); toast('Preview ready'); window.open('data:text/html;charset=utf-8,'+encodeURIComponent(j.html),'_blank') } catch{} }}>Preview</button>
							<button className="btn" onClick={async ()=>{ try{ const payload = { ...notif, segment: segments }; const r = await fetch(`${api}/admin/notifications/send`, { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(payload) }); const j = await r.json(); toast('Queued '+j.id) } catch{} }}>Send</button>
						</div>
					</div>
				</div>
			)}

			{tab==='billing' && (
				<div className="panel" style={{ display:'grid', gap:12 }}>
					<div style={{ display:'flex', alignItems:'center', gap:8 }}>
						<label className="kpi-title">Workspace</label>
						<input className="input" value={wsId} onChange={(e)=> setWsId(e.target.value)} style={{ maxWidth:200 }} />
						<button className="btn" onClick={loadWsBilling}>Load</button>
					</div>
					{wsBilling ? (
						<div style={{ display:'grid', gap:8 }}>
							<div className="kpi-title">Plan: {wsBilling.plan} • Status: {wsBilling.subscription_status}</div>
							<div className="kpi-title">Credits: €{(wsBilling.credits_cents||0)/100}</div>
							<div style={{ display:'flex', gap:8 }}>
								<input className="input" placeholder="Add credits (cents)" id="add_credits" style={{ maxWidth:200 }} />
								<button className="btn" onClick={async ()=>{ const cents = parseInt(document.getElementById('add_credits')?.value||'0',10)||0; try{ await fetch(withAdmin(`${api}/admin/workspaces/${wsId}/credits`), { method:'POST', headers:{ ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ cents }) }); toast('Credit added'); loadWsBilling() } catch{} }}>Add</button>
							</div>
						</div>
					) : (<div className="kpi-title">No billing data</div>)}
				</div>
			)}

			{tab==='logs' && (
				<div className="panel" style={{ display:'grid', gap:8 }}>
					<div className="kpi-title">Activity</div>
					<ul style={{ margin:0, paddingLeft:16 }}>
						{activity.map((a,i)=> (<li key={i} className="kpi-title">[{a.created_at}] {a.kind} {a.entity} {a.entity_id||''}</li>))}
						{!activity.length && <li className="kpi-title">No activity</li>}
					</ul>
				</div>
			)}

			{search && (
				<div className="panel" style={{ marginTop:12 }}>
					<div className="kpi-title" style={{ marginBottom:8 }}>Search results</div>
					<div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12 }}>
						<div>
							<div className="kpi-title">Users</div>
							<ul style={{ margin:0, paddingLeft:16 }}>{(search.users||[]).map((u)=> (<li key={u.id} className="kpi-title">{u.email||u.id}</li>))}</ul>
						</div>
						<div>
							<div className="kpi-title">Workspaces</div>
							<ul style={{ margin:0, paddingLeft:16 }}>{(search.workspaces||[]).map((w)=> (<li key={w.id} className="kpi-title">{w.name}</li>))}</ul>
						</div>
						<div>
							<div className="kpi-title">Calls</div>
							<ul style={{ margin:0, paddingLeft:16 }}>{(search.calls||[]).map((c)=> (<li key={c.id} className="kpi-title">{c.id}</li>))}</ul>
						</div>
						<div>
							<div className="kpi-title">Campaigns</div>
							<ul style={{ margin:0, paddingLeft:16 }}>{(search.campaigns||[]).map((c)=> (<li key={c.id} className="kpi-title">{c.name}</li>))}</ul>
						</div>
					</div>
				</div>
			)}

			{/* User Drawer */}
			<Drawer open={userOpen} onClose={()=> setUserOpen(false)} title={userForm ? (userForm.email||userForm.id) : 'User'}>
				{userForm && (
					<div style={{ display:'grid', gap:8 }}>
						<label className="kpi-title">Locale</label>
						<input className="input" value={userForm.locale||''} onChange={(e)=> setUserForm({ ...userForm, locale:e.target.value })} />
						<label className="kpi-title">Timezone</label>
						<input className="input" value={userForm.tz||''} onChange={(e)=> setUserForm({ ...userForm, tz:e.target.value })} />
						<label className="kpi-title">Status</label>
						<select className="input" value={userForm.status||'active'} onChange={(e)=> setUserForm({ ...userForm, status:e.target.value })}>
							<option value="active">active</option>
							<option value="suspended">suspended</option>
						</select>
						<div style={{ display:'flex', gap:8, marginTop:8 }}>
							<button className="btn" onClick={()=> setUserOpen(false)}>Close</button>
							<button className="btn" onClick={saveUser}>Save</button>
						</div>
					</div>
				)}
			</Drawer>

			{/* Workspace Drawer */}
			<Drawer open={wsOpen} onClose={()=> setWsOpen(false)} title={wsForm ? (`Workspace ${wsForm.id}`) : 'Workspace'}>
				{wsForm && (
					<div style={{ display:'grid', gap:8 }}>
						<label className="kpi-title">Plan</label>
						<input className="input" value={wsForm.plan_id||''} onChange={(e)=> setWsForm({ ...wsForm, plan_id:e.target.value })} />
						<label className="kpi-title">Concurrency limit</label>
						<input className="input" type="number" value={wsForm.concurrency_limit||0} onChange={(e)=> setWsForm({ ...wsForm, concurrency_limit: parseInt(e.target.value||'0',10) })} />
						<label className="kpi-title">Suspended</label>
						<select className="input" value={wsForm.suspended? 'true':'false'} onChange={(e)=> setWsForm({ ...wsForm, suspended: e.target.value==='true' })}>
							<option value="false">false</option>
							<option value="true">true</option>
						</select>
						<div style={{ display:'flex', gap:8, marginTop:8 }}>
							<button className="btn" onClick={()=> setWsOpen(false)}>Close</button>
							<button className="btn" onClick={saveWorkspace}>Save</button>
						</div>
					</div>
				)}
			</Drawer>
		</div>
	)
}



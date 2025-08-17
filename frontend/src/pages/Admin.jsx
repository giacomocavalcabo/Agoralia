import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function Admin() {
	const [services, setServices] = useState([])
	const [error, setError] = useState('')
	const email = (typeof window!=='undefined' && localStorage.getItem('admin_email')) || ''
	async function load(){
		setError('')
		try {
			const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/health`, { headers:{ 'X-Admin-Email': email } })
			if (!res.ok) throw new Error('Forbidden')
			const j = await res.json()
			setServices(j.services || [])
		} catch(e){ setError('Admin required or network error') }
	}
	useEffect(()=>{ if(email) load() },[])
	return (
		<div>
			<h1>Admin</h1>
			<div className="panel" style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
				<input className="input" placeholder="Admin email" defaultValue={email} onBlur={(e)=> localStorage.setItem('admin_email', e.target.value)} />
				<button className="btn" onClick={load}>Load</button>
				{error && <span className="kpi-title" style={{ color:'#b91c1c' }}>{error}</span>}
			</div>
			<div className="panel" style={{ display:'grid', gap:8 }}>
				<div className="kpi-title" style={{ textTransform:'uppercase' }}>System health</div>
				{services.map((s,i)=> (
					<div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
						<span style={{ width:8, height:8, borderRadius:999, background: s.status==='ok' ? '#10b981' : s.status==='warn' ? '#f59e0b' : '#ef4444' }} />
						<span>{s.name}</span>
					</div>
				))}
				{!services.length && <div className="kpi-title">No data</div>}
			</div>
		</div>
	)
}



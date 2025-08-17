import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function UsageBar() {
	const [usage, setUsage] = useState(null)
	useEffect(() => { apiFetch('/me/usage').then(setUsage).catch(()=> setUsage(null)) }, [])
	if (!usage) return null
	const cap = Math.max(usage.minutes_cap || 0, 1)
	const pct = Math.min(100, Math.round(((usage.minutes_mtd || 0) / cap) * 100))
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth:200 }}>
			<div style={{ flex:1, height: 8, background: '#e5e7eb', borderRadius: 999 }}>
				<div style={{ width: `${pct}%`, height: 8, background: pct > 80 ? '#f59e0b' : '#10b981', borderRadius: 999 }} />
			</div>
			<span className="kpi-title">{usage.minutes_mtd ?? 0}/{cap} min</span>
		</div>
	)
}

import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export default function UsageBar() {
	const [usage, setUsage] = useState(null)
	useEffect(() => { apiFetch('/me/usage').then(setUsage).catch(()=> setUsage(null)) }, [])
	if (!usage) return null
	const cap = Math.max(usage.minutes_cap || 0, 1)
	const pct = Math.min(100, Math.round(((usage.minutes_mtd || 0) / cap) * 100))
	return (
		<div className="flex items-center gap-2 min-w-[200px]">
			<div className="flex-1 h-2 bg-line rounded-full">
				<div className={`h-2 rounded-full ${pct>80?'bg-warn':'bg-success'}`} style={{ width: `${pct}%` }} />
			</div>
			<span className="kpi-title">{usage.minutes_mtd ?? 0}/{cap} min</span>
		</div>
	)
}

import React from 'react'

export default function StatusPill({ 
	tone = 'neutral', 
	label, 
	service = false,
	lastUpdate = null,
	className = ''
}) {
	const toneMap = { 
		success: 'success', 
		info: 'info', 
		warn: 'warn', 
		danger: 'danger', 
		neutral: 'ink-600' 
	}
	const color = toneMap[tone] || 'ink-600'
	
	// Check if service needs ping animation (updated in last 10 seconds)
	const needsPing = service && lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 10000
	
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-bg-app px-2.5 py-0.5 text-xs text-ink-600 ${className}`}>
			<span className={`h-1.5 w-1.5 rounded-full bg-${color} ${needsPing ? 'animate-ping' : ''}`}></span>
			{label}
		</span>
	)
}



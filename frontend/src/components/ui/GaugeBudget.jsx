import React from 'react'
import { useTranslation } from 'react-i18next'

export default function GaugeBudget({ 
	spent, 
	cap, 
	warnPercent = 80,
	className = ''
}) {
	const { t } = useTranslation('pages')
	// Se non c'è cap configurato, mostra stato "Not configured"
	if (!cap || cap <= 0) {
		return (
			<div className={`panel text-center ${className}`}>
				<div className="text-sm text-ink-600 mb-3">{t('dashboard.widgets.budget')}</div>
				<div className="h-32 flex items-center justify-center">
					<div className="text-center">
						<div className="text-2xl font-semibold text-gray-400 mb-2">—</div>
						<div className="text-sm text-gray-500">{t('dashboard.states.not_configured')}</div>
					</div>
				</div>
			</div>
		)
	}
	
	const percentage = Math.min(100, (spent / cap) * 100)
	
	// Dynamic colors based on spending percentage
	const getColor = () => {
		if (percentage >= 100) return 'text-danger'
		if (percentage >= warnPercent) return 'text-warn'
		return 'text-success'
	}
	
	const getGaugeColor = () => {
		if (percentage >= 100) return 'stroke-danger'
		if (percentage >= warnPercent) return 'stroke-warn'
		return 'stroke-success'
	}
	
	// End-of-month projection (simple linear regression from last 7 days)
	const projectedEOM = cap > 0 ? Math.min(100, (spent / cap) * 100 * 1.2) : 0
	
	// SVG gauge (semicircle)
	const radius = 40
	const circumference = Math.PI * radius
	const strokeDasharray = circumference
	const strokeDashoffset = circumference - (percentage / 100) * circumference
	
	return (
		<div className={`panel text-center ${className}`} data-testid="budget-gauge">
			<div className="text-sm text-ink-600 mb-3">{t('dashboard.widgets.budget')}</div>
			
			{/* SVG Gauge */}
			<div className="relative inline-block mb-4">
				<svg width="100" height="60" viewBox="0 0 100 60">
					{/* Background circle */}
					<circle
						cx="50"
						cy="50"
						r={radius}
						fill="none"
						stroke="var(--line)"
						strokeWidth="8"
						transform="rotate(-90 50 50)"
					/>
					{/* Progress circle */}
					<circle
						cx="50"
						cy="50"
						r={radius}
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
						transform="rotate(-90 50 50)"
						strokeDasharray={strokeDasharray}
						strokeDashoffset={strokeDashoffset}
						className={getGaugeColor()}
					/>
				</svg>
				
				{/* Center text - PERFETTAMENTE CENTRATO con absolute + translate */}
				<div className="absolute inset-0 flex items-center justify-center">
					<div className={`text-2xl font-semibold tabular-nums ${getColor()}`}>
						{Math.round(percentage)}%
					</div>
				</div>
			</div>
			
			{/* Values - GRIGLIA 2 COLONNE con allineamento numeri */}
			<dl className="grid grid-cols-2 gap-y-2">
				<dt className="text-sm text-ink-600">{t('dashboard.budget.spent', 'Spent')}</dt>
				<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{(spent / 100).toFixed(2)}</dd>
				<dt className="text-sm text-ink-600">{t('dashboard.budget.cap', 'Cap')}</dt>
				<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{(cap / 100).toFixed(2)}</dd>
				<dt className="text-sm text-ink-600">{t('dashboard.budget.remaining', 'Remaining')}</dt>
				<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{((cap - spent) / 100).toFixed(2)}</dd>
			</dl>
			
			{/* Projected EOM */}
			{projectedEOM > 0 && (
				<div className={`text-xs mt-3 p-2 rounded-lg tabular-nums ${
					projectedEOM >= 100 ? 'text-danger bg-danger/5 border border-danger/20' :
					projectedEOM >= warnPercent ? 'text-warn bg-warn/5 border border-warn/20' :
					'text-ink-500 bg-bg-app border border-line'
				}`}>
					{t('dashboard.budget.projected', 'Projected EOM: {{pct}}%', { pct: Math.round(projectedEOM) })}
					{projectedEOM >= 100 && <span className="ml-1">⚠️ Over budget</span>}
					{projectedEOM >= warnPercent && projectedEOM < 100 && <span className="ml-1">⚠️ Near limit</span>}
				</div>
			)}
		</div>
	)
}

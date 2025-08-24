import React from 'react'
import { useTranslation } from 'react-i18next'

export default function GaugeBudget({ 
	spent, 
	cap, 
	projectedEom,
	warnPercent = 80,
	labelPosition = 'outside',
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
	
	const pctRaw = cap ? (spent / cap) * 100 : 0;
	const pct = Math.max(0, Math.min(100, Math.round(pctRaw)));
	
	// Dynamic colors based on spending percentage
	const getColor = () => {
		if (pct >= 100) return 'text-danger'
		if (pct >= warnPercent) return 'text-warn'
		return 'text-success'
	}
	
	const getGaugeColor = () => {
		if (pct >= 100) return 'stroke-danger'
		if (pct >= warnPercent) return 'stroke-warn'
		return 'stroke-success'
	}
	
	// SVG gauge (semicircle)
	const radius = 40
	const circumference = Math.PI * radius
	const strokeDasharray = circumference
	const strokeDashoffset = circumference - (pct / 100) * circumference
	
	const Gauge = (
		<div className="relative h-24 w-28 shrink-0" role="img" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
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
			{labelPosition === 'inside' && (
				<span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-semibold tabular-nums leading-none whitespace-nowrap">
					{pct}%
				</span>
			)}
		</div>
	);

	return (
		<div className={`panel text-center ${className}`} data-testid="budget-gauge">
			<div className="text-sm text-ink-600 mb-3">{t('dashboard.widgets.budget')}</div>
			
			{labelPosition === 'outside' ? (
				<div className="flex items-center gap-3 justify-center mb-4">
					{Gauge}
					<div className="text-3xl font-semibold tabular-nums leading-none whitespace-nowrap">{pct}%</div>
				</div>
			) : (
				<div className="mb-4">{Gauge}</div>
			)}
			
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
			{cap && (
				<div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-sm tabular-nums">
					{t('dashboard.budget.projected', 'Projected EOM: {{pct}}%', { pct: projectedEom ?? pct })}
				</div>
			)}
		</div>
	)
}

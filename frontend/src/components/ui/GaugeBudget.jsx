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
	const hasCap = Number(cap) > 0
	const pctRaw = hasCap ? (spent / cap) * 100 : 0;
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
			{hasCap ? (
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
			) : (
				<div className="w-full h-full bg-gray-200 rounded-full opacity-25" />
			)}
			{labelPosition === 'inside' && hasCap && (
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
					<div className="text-3xl font-semibold tabular-nums leading-none whitespace-nowrap">
						{hasCap ? `${pct}%` : '—'}
					</div>
				</div>
			) : (
				<div className="mb-4">{Gauge}</div>
			)}
			
			{/* Values - GRIGLIA 2 COLONNE con allineamento numeri */}
			{hasCap ? (
				<dl className="grid grid-cols-2 gap-y-2">
					<dt className="text-sm text-ink-600">{t('dashboard.budget.spent', 'Spent')}</dt>
					<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{(spent / 100).toFixed(2)}</dd>
					<dt className="text-sm text-ink-600">{t('dashboard.budget.cap', 'Cap')}</dt>
					<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{(cap / 100).toFixed(2)}</dd>
					<dt className="text-sm text-ink-600">{t('dashboard.budget.remaining', 'Remaining')}</dt>
					<dd className="text-sm font-semibold text-ink-900 text-right tabular-nums whitespace-nowrap">€{((cap - spent) / 100).toFixed(2)}</dd>
				</dl>
			) : (
				<div className="mt-4 text-center text-sm text-gray-500">{t('dashboard.budget.not_configured')}</div>
			)}
			
			{/* Footer coerente (occupazione uniforma la card) */}
			<div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-sm tabular-nums">
				{hasCap ? t('dashboard.budget.projected', 'Projected EOM: {{pct}}%', { pct: projectedEom ?? pct }) : '—'}
			</div>
			
			{/* Detailed breakdown below gauge for better UX */}
			{hasCap && (
				<div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 tabular-nums">
					<div className="text-center p-2 bg-gray-50 rounded-lg">
						<div className="font-medium text-gray-900">{t('dashboard.budget.spent', 'Spent')}</div>
						<div className="text-lg font-bold text-ink-900">€{(spent / 100).toFixed(2)}</div>
						<div className="text-xs text-gray-500">{Math.round(pct)}% of budget</div>
					</div>
					<div className="text-center p-2 bg-gray-50 rounded-lg">
						<div className="font-medium text-gray-900">{t('dashboard.budget.remaining', 'Remaining')}</div>
						<div className="text-lg font-bold text-ink-900">€{Math.max((cap - spent) / 100, 0).toFixed(2)}</div>
						<div className="text-xs text-gray-500">{Math.round(100 - pct)}% left</div>
					</div>
				</div>
			)}
		</div>
	)
}

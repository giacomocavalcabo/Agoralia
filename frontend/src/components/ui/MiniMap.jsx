import React from 'react'
import { useI18n } from '../../lib/i18n.jsx'

export default function MiniMap({ 
	data = [],
	className = '',
	bare = false,
	title = 'Geographic Distribution'
}) {
	const { t } = useI18n('pages')
	// Only show real data, no placeholder data
	const displayData = data
	
	const maxCalls = Math.max(...displayData.map(d => d.calls))
	
	const Wrapper = ({children}) => bare ? <>{children}</> :
		<div className={`rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 ${className}`}>{children}</div>;
	
	return (
		<Wrapper>
			{!bare && <div className="text-sm font-semibold text-gray-900 mb-4">{t('dashboard.geo.title', 'Geographic Distribution')}</div>}
			
			{displayData.length === 0 ? (
				<div className="text-center py-8">
					<div className="text-4xl mb-2">🗺️</div>
					<div className="text-sm text-gray-600 mb-4">{t('dashboard.geo.coming_soon', 'Map visualization coming soon')}</div>
					<div className="text-xs text-gray-500">{t('dashboard.geo.empty', 'No geographic data available')}</div>
				</div>
			) : (
				<>
					{/* Placeholder map visualization */}
					<div className="text-center py-4">
						<div className="text-2xl mb-2">🗺️</div>
						<div className="text-sm text-gray-600 mb-4">{t('dashboard.geo.coming_soon', 'Map visualization coming soon')}</div>
					</div>
					
					{/* Simple country list with heat indicators */}
					<div className="space-y-2">
						{displayData.map(country => {
							const intensity = maxCalls > 0 ? (country.calls / maxCalls) * 100 : 0
							
							return (
								<div key={country.iso2} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
									<div className="flex items-center gap-2">
										<div className={`w-3 h-3 rounded-full ${country.color}`}></div>
										<span className="text-sm font-medium text-gray-900">{country.iso2}</span>
									</div>
									<div className="flex items-center gap-3">
										<div className="text-xs text-gray-600">
											{country.calls} {t('dashboard.geo.calls', 'calls')}
										</div>
										<div className="text-xs text-gray-600">
											{country.qualified} {t('dashboard.geo.qualified', 'qualified')}
										</div>
										<div className="w-16 bg-gray-200 rounded-full h-2">
											<div 
												className={`h-2 rounded-full ${country.color} transition-all duration-500`}
												style={{ width: `${intensity}%` }}
											></div>
										</div>
									</div>
								</div>
							)
						})}
					</div>
				</>
			)}
			
			{/* Summary */}
			<div className="mt-4 pt-4 border-t border-gray-200">
				<div className="text-xs text-gray-600">
					{t('dashboard.geo.top_country', 'Top country')}: {displayData[0]?.iso2} ({displayData[0]?.calls} {t('dashboard.geo.calls', 'calls')})
				</div>
			</div>
		</Wrapper>
	)
}

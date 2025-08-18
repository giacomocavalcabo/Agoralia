import React from 'react'

export function FilterChips({ chips = [], onRemove, onClear }){
	if (!chips.length) return null
	return (
		<div className="flex flex-wrap items-center gap-2 mb-2">
			{chips.map((c)=> (
				<span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-app px-2 py-0.5 text-xs text-ink-600">
					{c.label}
					<button aria-label="Remove" onClick={()=> onRemove?.(c.key)} className="text-ink-600 hover:text-ink-900">×</button>
				</span>
			))}
			<button onClick={onClear} className="text-xs text-ink-600 hover:text-ink-900">Clear all</button>
		</div>
	)
}

export default function DataTable({ columns = [], rows = [], chips = [], onRemoveChip, onClearChips }){
	return (
		<div className="rounded-xl border border-line bg-bg-card shadow-soft overflow-hidden">
			<div className="px-3 pt-3">
				<FilterChips chips={chips} onRemove={onRemoveChip} onClear={onClearChips} />
			</div>
			<div className="overflow-auto">
				<table className="w-full">
					<thead className="sticky top-0 bg-bg-card border-b border-line">
						<tr>
							<th className="w-10 p-2"><input aria-label="Select all" type="checkbox" /></th>
							{columns.map((c)=> (
								<th key={c.key} className="text-left text-sm font-semibold text-ink-600 p-2">{c.label}</th>
							))}
							<th className="w-10 p-2" />
						</tr>
					</thead>
					<tbody>
						{rows.map((r,i)=> (
							<tr key={i} className="hover:bg-bg-app/60">
								<td className="p-2"><input aria-label="Select row" type="checkbox" /></td>
								{columns.map((c)=> (
									<td key={c.key} className="p-2 text-sm text-ink-900">{r[c.key]}</td>
								))}
								<td className="p-2 text-right text-sm text-ink-600">•••</td>
							</tr>
						))}
						{!rows.length && (
							<tr><td colSpan={columns.length+2} className="p-4 text-center text-sm text-ink-600">No data</td></tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}



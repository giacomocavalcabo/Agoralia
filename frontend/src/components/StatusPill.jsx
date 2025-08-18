export default function StatusPill({ tone = 'neutral', label }){
	const toneToClass = {
		success: 'bg-success',
		info: 'bg-info',
		warn: 'bg-warn',
		danger: 'bg-danger',
		neutral: 'bg-ink-600'
	}
	const dotClass = toneToClass[tone] || 'bg-ink-600'
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-app px-2 py-0.5 text-xs text-ink-600">
			<span className={`h-1.5 w-1.5 rounded-full ${dotClass}`}></span>
			{label}
		</span>
	)
}



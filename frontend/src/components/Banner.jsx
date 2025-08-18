export default function Banner({ tone='info', title, children, action }){
	const toneToRing = {
		info: 'ring-info/20 bg-info/5',
		success: 'ring-success/20 bg-success/5',
		warn: 'ring-warn/20 bg-warn/5',
		danger: 'ring-danger/20 bg-danger/5'
	}
	const classes = toneToRing[tone] || 'ring-info/20 bg-info/5'
	return (
		<div className={`rounded-xl border border-line ${classes} px-4 py-3 flex items-start gap-3`} role="status" aria-live="polite">
			<div className={`h-2 w-2 rounded-full mt-1.5 ${tone==='info'?'bg-info':tone==='success'?'bg-success':tone==='warn'?'bg-warn':'bg-danger'}`} />
			<div className="flex-1">
				{title && <div className="text-sm font-semibold text-ink-900">{title}</div>}
				{children && <div className="text-sm text-ink-600">{children}</div>}
			</div>
			{action}
		</div>
	)
}



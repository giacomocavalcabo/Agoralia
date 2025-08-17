export function Skeleton({ height=16, width='100%', rounded=8 }){
	return <div style={{ height, width, background:'var(--border)', borderRadius:rounded, opacity:.6 }} />
}

export function SkeletonRow({ lines=3 }){
	return (
		<div className="panel" style={{ display:'grid', gap:8 }}>
			{Array.from({ length: lines }).map((_,i)=>(<Skeleton key={i} />))}
		</div>
	)
}

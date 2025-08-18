import { useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import EmptyState from '../components/EmptyState.jsx'

function parseNumbers(text){
	const lines = (text || '').split(/\r?\n/)
	const nums = []
	for (const ln of lines){
		const m = ln.trim().match(/^\+\d{6,15}$/)
		if (m) nums.push(m[0])
	}
	return nums
}

export default function Import(){
	const { t } = useI18n()
	const [step, setStep] = useState(1)
	const [raw, setRaw] = useState('')
	const [fileName, setFileName] = useState('')
	const numbers = useMemo(()=> parseNumbers(raw), [raw])

	function onFile(e){
		const f = e.target.files?.[0]
		if (!f) return
		setFileName(f.name)
		const reader = new FileReader()
		reader.onload = () => setRaw(String(reader.result || ''))
		reader.readAsText(f)
	}

	return (
		<div style={{ display:'grid', gap:12 }}>
			<div style={{ display:'flex', alignItems:'center', gap:8 }}>
				{[1,2,3,4].map((s)=> (
					<button key={s} onClick={()=> setStep(s)} aria-current={step===s ? 'page' : undefined} style={{ padding:'6px 10px', border:'1px solid var(--border)', background: step===s ? 'var(--surface)' : 'transparent', borderRadius:8 }}>Step {s}</button>
				))}
				<div className="kpi-title" style={{ marginLeft:'auto' }}>{t('pages.import.title')}</div>
			</div>

			{step===1 && (
				<div className="panel" style={{ display:'grid', gap:12 }}>
					<div style={{ fontWeight:700 }}>{t('pages.import.steps.source')}</div>
					<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
						<label>
							<div className="kpi-title">{t('pages.import.paste_numbers')}</div>
							<textarea value={raw} onChange={e=> setRaw(e.target.value)} placeholder={'+393331234567\n+442012345678'} style={{ width:'100%', minHeight:160, padding:10, border:'1px solid var(--border)', borderRadius:8 }} />
						</label>
						<div>
							<div className="kpi-title">{t('pages.import.upload_csv')}</div>
							<input type="file" accept=".csv,.txt" onChange={onFile} />
							{fileName && <div className="kpi-title" style={{ marginTop:6 }}>{fileName}</div>}
							<div style={{ marginTop:12 }}>
								<div className="kpi-title">{t('pages.import.preview')}</div>
								<div className="panel" style={{ maxHeight:200, overflow:'auto' }}>
									{numbers.length===0 ? (
										<EmptyState title={t('pages.import.no_numbers')} description={t('pages.import.no_numbers_desc')} />
									) : (
										<ul style={{ margin:0, padding:12, listStyle:'none', display:'grid', gap:6 }}>
											{numbers.slice(0,50).map((n,i)=> (<li key={i} className="kpi-title">{n}</li>))}
										</ul>
									)}
								</div>
							</div>
						</div>
						<div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
							<button disabled={numbers.length===0} onClick={()=> setStep(2)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('common.next')}</button>
						</div>
					</div>
				</div>
			)}

			{step!==1 && (
				<EmptyState title={t('pages.import.wip')} description={t('pages.import.wip_desc')} />
			)}
		</div>
	)
}



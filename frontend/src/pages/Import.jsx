import { useMemo, useState } from 'react'
import { useI18n } from '../lib/i18n.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { apiFetch } from '../lib/api.js'

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
	const [preflight, setPreflight] = useState(null)

	function onFile(e){
		const f = e.target.files?.[0]
		if (!f) return
		setFileName(f.name)
		const reader = new FileReader()
		reader.onload = () => setRaw(String(reader.result || ''))
		reader.readAsText(f)
	}

	return (
		<div className="grid gap-3">
			<div className="flex items-center gap-2">
				{[1,2,3,4].map((s)=> (
					<button key={s} onClick={()=> setStep(s)} aria-current={step===s ? 'page' : undefined} className={`rounded-lg border border-line px-2.5 py-1.5 ${step===s ? 'bg-bg-app' : ''}`}>{t('pages.import.step', { s }) || `Step ${s}`}</button>
				))}
				<div className="kpi-title ml-auto">{t('pages.import.title')}</div>
			</div>

			{step===1 && (
				<div className="panel grid gap-3">
					<div className="font-semibold">{t('pages.import.steps.source')}</div>
					<div className="grid grid-cols-2 gap-3">
						<label>
							<div className="kpi-title">{t('pages.import.paste_numbers')}</div>
							<textarea value={raw} onChange={e=> setRaw(e.target.value)} placeholder={'+393331234567\n+442012345678'} className="w-full min-h-[160px] rounded-xl border border-line bg-white p-2.5" />
						</label>
						<div>
							<div className="kpi-title">{t('pages.import.upload_csv')}</div>
							<input type="file" accept=".csv,.txt" onChange={onFile} />
							{fileName && <div className="kpi-title mt-1.5">{fileName}</div>}
							<div className="mt-3">
								<div className="kpi-title">{t('pages.import.preview')}</div>
								<div className="panel max-h-[200px] overflow-auto">
									{numbers.length===0 ? (
										<EmptyState title={t('pages.import.no_numbers')} description={t('pages.import.no_numbers_desc')} />
									) : (
										<ul className="m-0 p-3 list-none grid gap-1.5">
											{numbers.slice(0,50).map((n,i)=> (<li key={i} className="kpi-title">{n}</li>))}
										</ul>
									)}
								</div>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<button disabled={numbers.length===0} onClick={()=> setStep(2)} className="btn disabled:opacity-50">{t('common.next')}</button>
						</div>
					</div>
				</div>
			)}

			{step===2 && (
				<div className="panel grid gap-3">
					<div className="font-semibold">{t('pages.import.compliance_preview') || 'Compliance Preview'}</div>
					<div className="kpi-title">{t('pages.import.compliance_preview_desc') || 'B2B vs B2C differences, quiet hours and registry requirements will be shown per country.'}</div>
					<div className="flex justify-end">
						<button onClick={()=> setStep(3)} className="btn">{t('common.next')}</button>
					</div>
				</div>
			)}

			{step===3 && (
				<div className="panel grid gap-3">
					<div className="font-semibold">{t('pages.import.preflight') || 'Pre‑flight'}</div>
					<button onClick={async ()=>{
						const items = numbers.map(e164=> ({ e164, contact_class:'b2b_prospect' }))
						const res = await apiFetch('/compliance/preflight', { method:'POST', body:{ items } })
						setPreflight(res)
					}} className="rounded-lg border border-line bg-bg-app px-3 py-2">{t('pages.import.preflight_run') || 'Run pre‑flight'}</button>
					{preflight && (
						<div>
							<div className="kpi-title">{t('pages.import.preflight_summary', { allow: preflight.summary.allow, delay: preflight.summary.delay, block: preflight.summary.block }) || `Summary: allow ${preflight.summary.allow}, delay ${preflight.summary.delay}, block ${preflight.summary.block}`}</div>
							<div className="grid grid-cols-3 gap-3">
								<div>
									<div className="kpi-title">{t('pages.import.allow') || 'Allow'}</div>
									<ul className="m-0 pl-4">
										{preflight.items.filter(x=> x.decision==='allow').slice(0,30).map((it,i)=> (<li key={`a${i}`} className="kpi-title">{it.e164}</li>))}
									</ul>
								</div>
								<div>
									<div className="kpi-title">{t('pages.import.delay') || 'Delay'}</div>
									<ul className="m-0 pl-4">
										{preflight.items.filter(x=> x.decision==='delay').slice(0,30).map((it,i)=> (<li key={`d${i}`} className="kpi-title">{it.e164} — {it.next_window_at}</li>))}
									</ul>
								</div>
								<div>
									<div className="kpi-title">{t('pages.import.block') || 'Block'}</div>
									<ul className="m-0 pl-4">
										{preflight.items.filter(x=> x.decision==='block').slice(0,30).map((it,i)=> (<li key={`b${i}`} className="kpi-title">{it.e164} — {(it.reasons||[]).join(',')}</li>))}
									</ul>
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}



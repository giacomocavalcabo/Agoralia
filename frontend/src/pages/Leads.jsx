import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'
import { useI18n } from '../lib/i18n.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'

function Chip({ label, onRemove }){
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-app px-2 py-0.5 text-xs text-ink-600">
			{label}
			<button onClick={onRemove} aria-label="Remove" style={{ border:'none', background:'transparent', cursor:'pointer' }}>✕</button>
		</span>
	)
}

function AddLeadModal({ open, onClose, onCreated }){
	const { t } = useI18n()
	const { toast } = useToast()
	const [form, setForm] = useState({ name:'', company:'', phone_e164:'', country_iso:'', lang:'', role:'supplier', consent:false })
	const [submitting, setSubmitting] = useState(false)
	async function submit(){
		try{
			setSubmitting(true)
			if (!/^\+\d{6,15}$/.test(form.phone_e164)) { toast(t('pages.leads.errors.e164')); setSubmitting(false); return }
			const res = await apiFetch('/leads', { method:'POST', body: form })
			onCreated?.(res)
			onClose?.()
			toast(t('pages.leads.toasts.added'))
		} catch(err){ toast(String(err?.message || err)) } finally { setSubmitting(false) }
	}
	return (
		<Modal title={t('pages.leads.add_title')} open={open} onClose={onClose} footer={
			<>
				<button onClick={onClose} style={{ padding:'8px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.cancel')}</button>
				<button disabled={submitting} onClick={submit} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('pages.leads.actions.add')}</button>
			</>
		}>
			<div style={{ display:'grid', gap:10 }}>
				<label>
					<div className="kpi-title">{t('pages.leads.fields.name')}</div>
					<input value={form.name} onChange={e=> setForm({ ...form, name:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
				</label>
				<label>
					<div className="kpi-title">{t('pages.leads.fields.company')}</div>
					<input value={form.company} onChange={e=> setForm({ ...form, company:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
				</label>
				<label>
					<div className="kpi-title">{t('pages.leads.fields.phone')}</div>
					<input placeholder={t('pages.leads.placeholders.e164')} value={form.phone_e164} onChange={e=> setForm({ ...form, phone_e164:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
				</label>
				<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
					<label>
						<div className="kpi-title">{t('pages.leads.fields.country')}</div>
						<input value={form.country_iso} onChange={e=> setForm({ ...form, country_iso:e.target.value.toUpperCase() })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
					</label>
					<label>
						<div className="kpi-title">{t('pages.leads.fields.lang')}</div>
						<input value={form.lang} onChange={e=> setForm({ ...form, lang:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }} />
					</label>
				</div>
				<label>
					<div className="kpi-title">{t('pages.leads.fields.role')}</div>
					<select value={form.role} onChange={e=> setForm({ ...form, role:e.target.value })} style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
						<option value="supplier">supplier</option>
						<option value="supplied">supplied</option>
					</select>
				</label>
				<label style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
					<input type="checkbox" checked={form.consent} onChange={e=> setForm({ ...form, consent:e.target.checked })} />
					<span className="kpi-title">{t('pages.leads.fields.consent')}</span>
				</label>
			</div>
		</Modal>
	)
}

export default function Leads(){
	const { t } = useI18n()
	const { toast } = useToast()
	const [loading, setLoading] = useState(true)
	const [items, setItems] = useState([])
	const [total, setTotal] = useState(0)
	const [page, setPage] = useState(0)
	const pageSize = 25
	const [chips, setChips] = useState([])
	const [addOpen, setAddOpen] = useState(false)

	async function load(){
		try{
			setLoading(true)
			const res = await apiFetch(`/leads?limit=${pageSize}&offset=${page*pageSize}`)
			setItems(res.items || [])
			setTotal(res.total || (res.items?.length || 0))
		} catch(err){ toast(String(err?.message || err)) } finally { setLoading(false) }
	}

	useEffect(()=>{ load() // eslint-disable-next-line
	},[page])

	const from = page*pageSize + (items.length ? 1 : 0)
	const to = page*pageSize + items.length

	return (
		<div className="grid gap-3">
			<div className="flex items-center gap-2">
				<button className="rounded-xl border border-line bg-bg-app px-3 py-2 text-sm">{t('pages.leads.actions.schedule')}</button>
				<button className="rounded-xl border border-line bg-bg-app px-3 py-2 text-sm">{t('pages.leads.actions.import')}</button>
				<div className="ml-auto flex gap-1.5">
					{chips.map((c,i)=>(<Chip key={i} label={c} onRemove={()=> setChips(chips.filter((_,j)=> j!==i))} />))}
				</div>
				<button onClick={()=> setAddOpen(true)} className="btn ml-2">{t('pages.leads.actions.add')}</button>
			</div>

			{loading ? (
				<div className="panel p-4">
					<div className="kpi-title">{t('common.loading')}</div>
				</div>
			) : items.length === 0 ? (
				<EmptyState title={t('pages.leads.empty.title')} description={t('pages.leads.empty.desc')} action={<button onClick={()=> setAddOpen(true)} className="btn">{t('pages.leads.actions.add')}</button>} />
			) : (
				<div className="panel overflow-auto">
					<table className="w-full border-separate" style={{ borderSpacing:0 }}>
						<thead>
							<tr>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.name')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.company')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.phone')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.country')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.lang')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.role')}</th>
								<th className="kpi-title text-left px-3 py-2">{t('pages.leads.cols.consent')}</th>
								<th style={{ width:1 }}></th>
							</tr>
						</thead>
						<tbody>
							{items.map((it)=> (
								<tr key={it.id}>
									<td className="px-3 py-2">{it.name}</td>
									<td className="px-3 py-2">{it.company}</td>
									<td className="px-3 py-2">{it.phone_e164}</td>
									<td className="px-3 py-2">{it.country_iso}</td>
									<td className="px-3 py-2">{it.lang}</td>
									<td className="px-3 py-2">{it.role}</td>
									<td className="px-3 py-2">{it.consent ? '✓' : ''}</td>
									<td className="px-3 py-2 text-right">
										<button className="kpi-title rounded-lg border border-line bg-bg-app px-2.5 py-1.5">{t('common.actions.more')}</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<div className="flex items-center gap-2 px-3 py-2 border-t border-line">
						<div className="kpi-title">{t('common.range', { from, to })} {t('common.of_total', { total })}</div>
						<div className="ml-auto flex gap-1.5">
							<button disabled={page===0} onClick={()=> setPage(p=> Math.max(0, p-1))} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5 disabled:opacity-50">{t('common.prev')}</button>
							<button disabled={to>=total} onClick={()=> setPage(p=> p+1)} className="rounded-lg border border-line bg-bg-app px-2.5 py-1.5 disabled:opacity-50">{t('common.next')}</button>
						</div>
					</div>
				</div>
			)}

			<AddLeadModal open={addOpen} onClose={()=> setAddOpen(false)} onCreated={()=> load()} />
		</div>
	)
}



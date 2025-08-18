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
		<div style={{ display:'grid', gap:12 }}>
			<div style={{ display:'flex', alignItems:'center', gap:8 }}>
				<button onClick={()=> setAddOpen(true)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('pages.leads.actions.add')}</button>
				<button style={{ padding:'8px 12px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.leads.actions.schedule')}</button>
				<button style={{ padding:'8px 12px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('pages.leads.actions.import')}</button>
				<div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
					{chips.map((c,i)=>(<Chip key={i} label={c} onRemove={()=> setChips(chips.filter((_,j)=> j!==i))} />))}
				</div>
			</div>

			{loading ? (
				<div className="panel" style={{ padding:16 }}>
					<div className="kpi-title">{t('common.loading')}</div>
				</div>
			) : items.length === 0 ? (
				<EmptyState title={t('pages.leads.empty.title')} description={t('pages.leads.empty.desc')} action={<button onClick={()=> setAddOpen(true)} style={{ padding:'8px 12px', border:'1px solid var(--brand)', background:'var(--brand)', color:'white', borderRadius:8, fontWeight:700 }}>{t('pages.leads.actions.add')}</button>} />
			) : (
				<div className="panel" style={{ overflow:'auto' }}>
					<table style={{ width:'100%', borderCollapse:'separate', borderSpacing:0 }}>
						<thead>
							<tr>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.name')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.company')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.phone')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.country')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.lang')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.role')}</th>
								<th className="kpi-title" style={{ textAlign:'left', padding:10 }}>{t('pages.leads.cols.consent')}</th>
								<th style={{ width:1 }}></th>
							</tr>
						</thead>
						<tbody>
							{items.map((it)=> (
								<tr key={it.id}>
									<td style={{ padding:10 }}>{it.name}</td>
									<td style={{ padding:10 }}>{it.company}</td>
									<td style={{ padding:10 }}>{it.phone_e164}</td>
									<td style={{ padding:10 }}>{it.country_iso}</td>
									<td style={{ padding:10 }}>{it.lang}</td>
									<td style={{ padding:10 }}>{it.role}</td>
									<td style={{ padding:10 }}>{it.consent ? '✓' : ''}</td>
									<td style={{ padding:10, textAlign:'right' }}>
										<button className="kpi-title" style={{ border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8, padding:'6px 10px' }}>{t('common.actions.more')}</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					<div style={{ display:'flex', alignItems:'center', gap:8, padding:10, borderTop:'1px solid var(--border)' }}>
						<div className="kpi-title">{t('common.range', { from, to })} {t('common.of_total', { total })}</div>
						<div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
							<button disabled={page===0} onClick={()=> setPage(p=> Math.max(0, p-1))} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.prev')}</button>
							<button disabled={to>=total} onClick={()=> setPage(p=> p+1)} style={{ padding:'6px 10px', border:'1px solid var(--border)', background:'var(--surface)', borderRadius:8 }}>{t('common.next')}</button>
						</div>
					</div>
				</div>
			)}

			<AddLeadModal open={addOpen} onClose={()=> setAddOpen(false)} onCreated={()=> load()} />
		</div>
	)
}



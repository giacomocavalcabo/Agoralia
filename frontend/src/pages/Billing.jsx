import { useI18n } from '../lib/i18n.jsx'

export default function Billing(){
	const { t } = useI18n()
	return (
		<div className="grid gap-3">
			<div className="panel">
				<div className="kpi-title mb-2">{t('pages.billing.title') || 'Billing'}</div>
				<div className="kpi-title">{t('pages.billing.desc') || 'Your plan, usage, and invoices will appear here.'}</div>
			</div>
		</div>
	)
}



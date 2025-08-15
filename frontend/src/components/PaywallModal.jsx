import Modal from './Modal.jsx'
import { useI18n } from '../lib/i18n.jsx'

export default function PaywallModal({ open, onClose, reason }) {
  const { t } = useI18n()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pages.billing.upgrade_required')}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <a className="btn" href="/billing" onClick={(e)=>{ e.preventDefault(); onClose(); window.history.pushState({}, '', '/billing'); window.dispatchEvent(new PopStateEvent('popstate')) }}>{t('pages.billing.go_to_billing')}</a>
        </div>
      )}
    >
      <div style={{ display:'grid', gap:8 }}>
        <div style={{ color:'#6b7280' }}>{reason || t('pages.billing.upgrade_reason')}</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>{t('pages.billing.manage_from_billing')}</div>
      </div>
    </Modal>
  )
}



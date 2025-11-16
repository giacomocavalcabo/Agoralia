import { useState } from 'react'
import { useI18n } from '../../lib/i18n.jsx'
import { apiRequest } from '../../lib/api'
import { useToast } from '../ToastProvider.jsx'
import Modal from '../Modal.jsx'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { LANG_OPTIONS } from '../../lib/languages.js'

export default function CreateResourceModal({
  type,
  open,
  onClose,
  onCreate,
  initialData
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  
  // Form state per agent
  const [agentName, setAgentName] = useState(initialData?.name || '')
  const [agentLang, setAgentLang] = useState(initialData?.lang || 'it-IT')
  const [agentVoiceId, setAgentVoiceId] = useState(initialData?.voice_id || '')
  
  // Form state per number
  const [numberE164, setNumberE164] = useState(initialData?.e164 || '')
  
  async function handleCreate() {
    setLoading(true)
    try {
      let body = {}
      let endpoint = ''
      
      if (type === 'agent') {
        endpoint = '/agents'
        body = { 
          name: agentName.trim(),
          lang: agentLang || undefined,
          voice_id: agentVoiceId.trim() || undefined
        }
      } else if (type === 'number') {
        endpoint = '/numbers'
        body = { 
          e164: numberE164.trim(),
          type: 'retell'
        }
      } else {
        toast.error(t('common.error') + ': ' + (t('pages.settings.tabs.agents') || 'Unknown type'))
        setLoading(false)
        return
      }
      
      const res = await apiRequest(endpoint, { method: 'POST', body })
      
      if (res.ok) {
        toast.success(t('common.success'))
        onCreate?.(res.data)
        onClose?.()
        // Reset form
        setAgentName('')
        setAgentLang('it-IT')
        setAgentVoiceId('')
        setNumberE164('')
      } else {
        toast.error(t('common.error') + ': ' + (res.error || res.status))
      }
    } catch (error) {
      toast.error(t('common.network_error'))
    } finally {
      setLoading(false)
    }
  }
  
  const isValid = type === 'agent' 
    ? agentName.trim().length > 0
    : type === 'number'
    ? numberE164.trim().length > 0
    : false
  
  const title = type === 'agent' 
    ? t('pages.dashboard.setup.bricks.agent.label')
    : type === 'number'
    ? t('pages.dashboard.setup.bricks.number.label')
    : type === 'knowledge'
    ? t('pages.dashboard.setup.bricks.knowledge.label')
    : type === 'leads'
    ? t('pages.dashboard.setup.bricks.leads.label')
    : t('common.create')
  
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreate} 
            disabled={!isValid || loading}
            loading={loading}
          >
            {t('common.create')}
          </Button>
        </div>
      }
    >
      {type === 'agent' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              {t('common.name')} *
            </label>
            <Input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder={t('pages.dashboard.setup.bricks.agent.label')}
              disabled={loading}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              {t('common.lang')}
            </label>
            <select
              className="input"
              value={agentLang}
              onChange={(e) => setAgentLang(e.target.value)}
              disabled={loading}
            >
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.locale} value={opt.locale}>
                  {opt.label} ({opt.locale})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              Voice ID ({t('common.default')})
            </label>
            <Input
              value={agentVoiceId}
              onChange={(e) => setAgentVoiceId(e.target.value)}
              placeholder="11labs-Adrian (optional)"
              disabled={loading}
            />
          </div>
          
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            {t('pages.dashboard.setup.bricks.agent.description')}
          </p>
        </div>
      )}
      
      {type === 'number' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              E.164 Number *
            </label>
            <Input
              value={numberE164}
              onChange={(e) => setNumberE164(e.target.value)}
              placeholder="+39 123456789"
              disabled={loading}
            />
          </div>
          
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            {t('pages.dashboard.setup.bricks.number.description')}
          </p>
        </div>
      )}
      
      {(type === 'knowledge' || type === 'leads') && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          {t('common.loading')}... ({type} creation not yet implemented)
        </div>
      )}
    </Modal>
  )
}


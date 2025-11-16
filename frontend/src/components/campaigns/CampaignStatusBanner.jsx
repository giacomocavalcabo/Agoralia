import { useI18n } from '../../lib/i18n.jsx'

export default function CampaignStatusBanner({
  status,
  message,
  missingNumber,
  missingAgent,
  missingKnowledge,
  missingLeads,
  outsideHours
}) {
  const { t } = useI18n()
  
  if (status === 'ready') {
    return (
      <div style={{
        background: '#F0FDF4',
        border: '1px solid #86EFAC',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24
      }}>
        <div style={{
          fontSize: 16,
          lineHeight: '24px',
          fontWeight: 600,
          color: '#15803D',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ✅ {t('pages.campaigns.status.ready') || 'Campaign ready to launch'}
        </div>
        {message && (
          <p style={{
            margin: '8px 0 0 0',
            fontSize: 14,
            lineHeight: '20px',
            color: '#15803D',
            opacity: 0.8
          }}>
            {message}
          </p>
        )}
      </div>
    )
  }
  
  if (status === 'not-ready') {
    const issues = []
    if (missingNumber) issues.push(t('pages.dashboard.setup.bricks.number.label'))
    if (missingAgent) issues.push(t('pages.dashboard.setup.bricks.agent.label'))
    if (missingKnowledge) issues.push(t('pages.dashboard.setup.bricks.knowledge.label'))
    if (missingLeads) issues.push(t('pages.dashboard.setup.bricks.leads.label'))
    if (outsideHours) issues.push(t('pages.campaigns.status.outside_hours') || 'outside business hours')
    
    const issueText = issues.length > 0 
      ? issues.join(', ')
      : message || t('pages.campaigns.status.not_ready') || 'Campaign cannot launch'
    
    return (
      <div style={{
        background: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24
      }}>
        <div style={{
          fontSize: 16,
          lineHeight: '24px',
          fontWeight: 600,
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          ⚠️ {t('pages.campaigns.status.not_ready') || 'Campaign cannot launch'}
        </div>
        <p style={{
          margin: '8px 0 0 0',
          fontSize: 14,
          lineHeight: '20px',
          color: '#92400E',
          opacity: 0.9
        }}>
          {issueText}
        </p>
      </div>
    )
  }
  
  return null
}


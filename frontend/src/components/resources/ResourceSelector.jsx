import { useI18n } from '../../lib/i18n.jsx'
import Button from '../ui/Button'

const BRICK_ICONS = {
  number: '📞',
  knowledge: '📚',
  agent: '🤖',
  leads: '👥'
}

function getResourceStatusBadge(resource, type) {
  if (!resource) return null
  
  if (type === 'number') {
    if (resource.verified) return { label: 'Active', variant: 'success' }
    return { label: 'Pending', variant: 'warning' }
  }
  
  if (type === 'knowledge') {
    if (resource.status === 'ready' || resource.status === 'synced') return { label: 'Ready', variant: 'success' }
    if (resource.status === 'syncing') return { label: 'Syncing', variant: 'warning' }
    if (resource.status === 'error') return { label: 'Error', variant: 'error' }
    return { label: 'Pending', variant: 'warning' }
  }
  
  if (type === 'agent') {
    if (resource.status === 'active' || !resource.status) return { label: 'Active', variant: 'success' }
    return { label: 'Disabled', variant: 'error' }
  }
  
  if (type === 'lead-list') {
    if (resource.lead_count > 0) return { label: `${resource.lead_count} leads`, variant: 'info' }
    return { label: 'Empty', variant: 'warning' }
  }
  
  return null
}

function getResourceDisplayName(resource, type) {
  if (!resource) return ''
  
  if (type === 'number') {
    return `${resource.e164 || resource.phone || 'Unknown'}${resource.country ? ` (${resource.country})` : ''}`
  }
  
  if (type === 'knowledge') {
    return `${resource.name || 'KB'}${resource.lang ? ` (${resource.lang})` : ''}`
  }
  
  if (type === 'agent') {
    return `${resource.name || 'Agent'}${resource.lang ? ` (${resource.lang})` : ''}${resource.voice_id ? ` - ${resource.voice_id}` : ''}`
  }
  
  if (type === 'lead-list') {
    return `${resource.name || 'List'}${resource.lead_count ? ` (${resource.lead_count})` : ''}`
  }
  
  return resource.name || resource.id || 'Unknown'
}

export default function ResourceSelector({
  type,
  value,
  onChange,
  options = [],
  filter,
  showCreate = false,
  onCreateClick,
  label,
  placeholder,
  disabled = false,
  error
}) {
  const { t } = useI18n()
  
  const icon = BRICK_ICONS[type] || '•'
  const filteredOptions = filter ? options.filter(filter) : options
  const selectedResource = options.find(opt => String(opt.id || opt.value) === String(value))
  const statusBadge = getResourceStatusBadge(selectedResource, type)
  
  const defaultPlaceholder = placeholder || 
    (type === 'number' ? t('common.none') || '(none)' :
     type === 'knowledge' ? t('common.none') || '(none)' :
     type === 'agent' ? t('common.default') || 'Default' :
     type === 'lead-list' ? t('common.none') || '(none)' :
     t('common.none') || '(none)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <label style={{ 
          fontSize: 14, 
          fontWeight: 500, 
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span>{icon}</span>
          <span>{label}</span>
        </label>
      )}
      
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? (type === 'agent' ? e.target.value : Number(e.target.value)) : null)}
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 200,
            borderColor: error ? 'var(--red)' : 'var(--border)'
          }}
        >
          <option value="">{defaultPlaceholder}</option>
          {filteredOptions.map((option) => {
            const optValue = option.id || option.value || option
            const optId = String(optValue)
            const displayName = getResourceDisplayName(option, type)
            const optStatus = getResourceStatusBadge(option, type)
            const isDisabled = type === 'knowledge' && option.status && option.status !== 'ready' && option.status !== 'synced'
            
            return (
              <option 
                key={optId} 
                value={optId}
                disabled={isDisabled}
              >
                {displayName} {optStatus ? `(${optStatus.label})` : ''}
              </option>
            )
          })}
        </select>
        
        {statusBadge && (
          <span style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 500,
            background: statusBadge.variant === 'success' ? 'var(--green)' :
                        statusBadge.variant === 'warning' ? 'var(--amber)' :
                        statusBadge.variant === 'error' ? 'var(--red)' :
                        'var(--border)',
            color: statusBadge.variant === 'error' || statusBadge.variant === 'success' ? 'white' : 'var(--text)'
          }}>
            {statusBadge.label}
          </span>
        )}
        
        {showCreate && onCreateClick && (
          <Button 
            variant="secondary" 
            size="sm"
            onClick={onCreateClick}
          >
            {t('common.add')}
          </Button>
        )}
      </div>
      
      {filteredOptions.length === 0 && !showCreate && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {t('pages.dashboard.setup.bricks.' + type + '.description')}
        </div>
      )}
      
      {error && (
        <div style={{ fontSize: 12, color: 'var(--red)' }}>
          {error}
        </div>
      )}
    </div>
  )
}


import { useI18n } from '../../lib/i18n.jsx'
import ResourceSelector from './ResourceSelector'

export default function BrickSelector({
  number,
  knowledge,
  agent,
  leads,
  numbers = [],
  kbs = [],
  agents = [],
  leadLists = [],
  showCreate = false,
  onCreate,
  disabled = false
}) {
  const { t } = useI18n()
  
  // Ordine fisso dei 4 mattoni
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 1. Numero Telefonico */}
      <ResourceSelector
        type="number"
        value={number?.value || null}
        onChange={number?.onChange || (() => {})}
        options={numbers}
        label={t('pages.dashboard.setup.bricks.number.label')}
        placeholder={t('common.none')}
        showCreate={showCreate}
        onCreateClick={showCreate && onCreate ? () => onCreate('number') : undefined}
        disabled={disabled}
      />
      
      {/* 2. Knowledge Base */}
      <ResourceSelector
        type="knowledge"
        value={knowledge?.value || null}
        onChange={knowledge?.onChange || (() => {})}
        options={kbs}
        filter={(kb) => kb.status === 'ready' || kb.status === 'synced' || !kb.status}
        label={t('pages.dashboard.setup.bricks.knowledge.label')}
        placeholder={t('common.none')}
        showCreate={showCreate}
        onCreateClick={showCreate && onCreate ? () => onCreate('knowledge') : undefined}
        disabled={disabled}
      />
      
      {/* 3. Agent */}
      <ResourceSelector
        type="agent"
        value={agent?.value || null}
        onChange={agent?.onChange || (() => {})}
        options={agents}
        label={t('pages.dashboard.setup.bricks.agent.label')}
        placeholder={t('common.default')}
        showCreate={showCreate}
        onCreateClick={showCreate && onCreate ? () => onCreate('agent') : undefined}
        disabled={disabled}
      />
      
      {/* 4. Leads */}
      <ResourceSelector
        type="lead-list"
        value={leads?.value || null}
        onChange={leads?.onChange || (() => {})}
        options={leadLists}
        label={t('pages.dashboard.setup.bricks.leads.label')}
        placeholder={t('common.none')}
        showCreate={showCreate}
        onCreateClick={showCreate && onCreate ? () => onCreate('leads') : undefined}
        disabled={disabled}
      />
    </div>
  )
}


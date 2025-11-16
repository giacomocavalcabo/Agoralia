import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { useToast } from '../components/ToastProvider.jsx'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import BrickSelector from '../components/resources/BrickSelector'
import CampaignStatusBanner from '../components/campaigns/CampaignStatusBanner'
import { safeArray } from '../lib/util'

export default function CampaignNew() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  
  // Resources
  const [numbers, setNumbers] = useState([])
  const [kbs, setKbs] = useState([])
  const [agents, setAgents] = useState([])
  const [leadLists, setLeadLists] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Campaign form
  const [name, setName] = useState('')
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [selectedKB, setSelectedKB] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [selectedLeads, setSelectedLeads] = useState(null)
  const [status, setStatus] = useState('draft')
  const [creating, setCreating] = useState(false)
  
  useEffect(() => {
    loadResources()
  }, [])
  
  async function loadResources() {
    setLoading(true)
    try {
      const [numbersRes, kbsRes, agentsRes, leadsRes] = await Promise.all([
        apiRequest(endpoints.numbers),
        apiRequest(endpoints.kbs),
        apiRequest(endpoints.agents),
        apiRequest(`${endpoints.leads}?limit=100`)
      ])
      
      setNumbers(safeArray(numbersRes.data || []).filter(n => n.verified))
      setKbs(safeArray(kbsRes.data || []).filter(kb => kb.status === 'ready' || kb.status === 'synced' || !kb.status))
      setAgents(safeArray(agentsRes.data || []))
      // Group leads by campaign or create a default list
      const leads = safeArray(leadsRes.data?.items || [])
      setLeadLists([{ id: 'all', name: 'All Leads', lead_count: leads.length }])
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }
  
  async function handleCreate() {
    if (!name.trim() || creating) return
    
    // Validate required bricks
    const hasNumber = selectedNumber && numbers.find(n => n.id === selectedNumber)?.verified
    const hasAgent = selectedAgent && agents.find(a => a.id === selectedAgent)
    
    if (!hasNumber) {
      toast.error(t('pages.dashboard.setup.bricks.number.label') + ' ' + t('common.error')?.toLowerCase() || 'required')
      return
    }
    
    if (!hasAgent) {
      toast.error(t('pages.dashboard.setup.bricks.agent.label') + ' ' + t('common.error')?.toLowerCase() || 'required')
      return
    }
    
    setCreating(true)
    try {
      const body = {
        name: name.trim(),
        status,
        agent_id: agents.find(a => a.id === selectedAgent)?.retell_agent_id || undefined,
        from_number_id: selectedNumber ? Number(selectedNumber) : undefined,
        kb_id: selectedKB ? Number(selectedKB) : undefined,
      }
      
      const res = await apiRequest('/campaigns', { method: 'POST', body })
      
      if (res.ok) {
        toast.success(t('pages.campaigns.created', { id: res.data?.id }))
        navigate(`/campaigns`)
      } else {
        toast.error(res.error || t('common.error_code', { code: res.status }))
      }
    } catch (error) {
      toast.error(t('common.network_error'))
    } finally {
      setCreating(false)
    }
  }
  
  function handleCreateResource(type) {
    // Navigate to dedicated page for creating resource
    if (type === 'number') navigate('/numbers')
    else if (type === 'knowledge') navigate('/settings?tab=kbs')
    else if (type === 'agent') navigate('/agents')
    else if (type === 'leads') navigate('/import')
  }
  
  // Check campaign readiness
  const hasNumber = selectedNumber && numbers.find(n => n.id === selectedNumber)?.verified
  const hasAgent = selectedAgent && agents.find(a => a.id === selectedAgent)
  const hasKnowledge = selectedKB && kbs.find(k => k.id === selectedKB)
  const hasLeads = leadLists.length > 0 && leadLists[0].lead_count > 0
  
  const isReady = hasNumber && hasAgent && name.trim().length > 0
  const missingNumber = !hasNumber
  const missingAgent = !hasAgent
  const missingKnowledge = !hasKnowledge
  const missingLeads = !hasLeads
  
  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        {t('common.loading')}...
      </div>
    )
  }
  
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageHeader
        title={t('pages.dashboard.create_campaign') || 'Create Campaign'}
        subtitle={t('pages.dashboard.setup.description')}
        secondaryAction={{
          label: t('common.cancel'),
          onClick: () => navigate('/campaigns'),
          size: 'sm'
        }}
      />
      
      <CampaignStatusBanner
        status={isReady ? 'ready' : 'not-ready'}
        missingNumber={missingNumber}
        missingAgent={missingAgent}
        missingKnowledge={missingKnowledge}
        missingLeads={missingLeads}
      />
      
      <Card>
        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              {t('common.name')} *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('pages.campaigns.name_placeholder')}
              disabled={creating}
            />
          </div>
          
          <BrickSelector
            number={{
              value: selectedNumber,
              onChange: setSelectedNumber
            }}
            knowledge={{
              value: selectedKB,
              onChange: setSelectedKB
            }}
            agent={{
              value: selectedAgent,
              onChange: setSelectedAgent
            }}
            leads={{
              value: selectedLeads,
              onChange: setSelectedLeads
            }}
            numbers={numbers}
            kbs={kbs}
            agents={agents}
            leadLists={leadLists}
            showCreate={true}
            onCreate={handleCreateResource}
            disabled={creating}
          />
          
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
              {t('common.status')}
            </label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={creating}
            >
              <option value="draft">Draft</option>
              <option value="active">{t('pages.campaigns.status.active')}</option>
              <option value="paused">{t('pages.campaigns.status.paused')}</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button
              variant="secondary"
              onClick={() => navigate('/campaigns')}
              disabled={creating}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!isReady || creating}
              loading={creating}
            >
              {t('common.create')} {t('pages.campaigns.title')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}


import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n.jsx'
import { apiRequest } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { useToast } from '../components/ToastProvider.jsx'
import PageHeader from '../components/layout/PageHeader'
import WizardContainer from '../components/wizard/WizardContainer'
import BrickCard from '../components/setup/BrickCard'
import { safeArray } from '../lib/util'

export default function Setup() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  
  const [numbers, setNumbers] = useState([])
  const [kbs, setKbs] = useState([])
  const [agents, setAgents] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Step states
  const [selectedNumber, setSelectedNumber] = useState(null)
  const [selectedKB, setSelectedKB] = useState(null)
  const [selectedAgent, setSelectedAgent] = useState(null)
  
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
        apiRequest(`${endpoints.leads}?limit=1`)
      ])
      
      setNumbers(safeArray(numbersRes.data || []))
      setKbs(safeArray(kbsRes.data || []))
      setAgents(safeArray(agentsRes.data || []))
      setLeads(safeArray(leadsRes.data?.items || []))
    } catch (error) {
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }
  
  function handleComplete() {
    // Check if all bricks are ready
    const hasNumber = selectedNumber && numbers.find(n => n.id === selectedNumber)?.verified
    const hasKB = selectedKB && kbs.find(k => k.id === selectedKB)?.status === 'ready'
    const hasAgent = selectedAgent && agents.find(a => a.id === selectedAgent)
    const hasLeads = leads.length > 0
    
    if (hasNumber && hasKB && hasAgent && hasLeads) {
      toast.success(t('pages.dashboard.setup.ready'))
      navigate('/campaigns/new')
    } else {
      toast.error(t('pages.dashboard.setup.incomplete'))
    }
  }
  
  function handleCreate(type) {
    // Navigate to dedicated page for creating resource
    if (type === 'number') navigate('/numbers')
    else if (type === 'knowledge') navigate('/settings?tab=kbs')
    else if (type === 'agent') navigate('/agents')
    else if (type === 'leads') navigate('/import')
  }
  
  const steps = [
    // Step 1: Phone Number
    <BrickCard
      key="number"
      type="number"
      title={t('pages.dashboard.setup.bricks.number.label')}
      description={t('pages.dashboard.setup.bricks.number.description')}
      completed={selectedNumber && numbers.find(n => n.id === selectedNumber)?.verified}
      onAction={numbers.length > 0 ? undefined : () => handleCreate('number')}
      actionLabel={numbers.length > 0 ? undefined : t('pages.dashboard.setup.complete_now')}
    >
      {numbers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            {t('common.select') || 'Select'} {t('pages.dashboard.setup.bricks.number.label')}
          </label>
          <select
            className="input"
            value={selectedNumber || ''}
            onChange={(e) => setSelectedNumber(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('common.none')}</option>
            {numbers.map((n) => (
              <option key={n.id} value={n.id} disabled={!n.verified}>
                {n.e164} {n.verified ? '(Verified)' : '(Pending)'}
              </option>
            ))}
          </select>
          {!selectedNumber && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {t('pages.dashboard.setup.bricks.number.description')}
            </p>
          )}
        </div>
      )}
    </BrickCard>,
    
    // Step 2: Knowledge Base
    <BrickCard
      key="knowledge"
      type="knowledge"
      title={t('pages.dashboard.setup.bricks.knowledge.label')}
      description={t('pages.dashboard.setup.bricks.knowledge.description')}
      completed={selectedKB && kbs.find(k => k.id === selectedKB)?.status === 'ready'}
      onAction={kbs.length > 0 ? undefined : () => handleCreate('knowledge')}
      actionLabel={kbs.length > 0 ? undefined : t('pages.dashboard.setup.complete_now')}
    >
      {kbs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            {t('common.select') || 'Select'} {t('pages.dashboard.setup.bricks.knowledge.label')}
          </label>
          <select
            className="input"
            value={selectedKB || ''}
            onChange={(e) => setSelectedKB(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('common.none')}</option>
            {kbs
              .filter(kb => kb.status === 'ready' || kb.status === 'synced' || !kb.status)
              .map((kb) => (
                <option key={kb.id} value={kb.id}>
                  KB #{kb.id} ({kb.lang || 'any'})
                </option>
              ))}
          </select>
          {!selectedKB && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {t('pages.dashboard.setup.bricks.knowledge.description')}
            </p>
          )}
        </div>
      )}
    </BrickCard>,
    
    // Step 3: Agent
    <BrickCard
      key="agent"
      type="agent"
      title={t('pages.dashboard.setup.bricks.agent.label')}
      description={t('pages.dashboard.setup.bricks.agent.description')}
      completed={selectedAgent && agents.find(a => a.id === selectedAgent)}
      onAction={agents.length > 0 ? undefined : () => handleCreate('agent')}
      actionLabel={agents.length > 0 ? undefined : t('pages.dashboard.setup.complete_now')}
    >
      {agents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            {t('common.select') || 'Select'} {t('pages.dashboard.setup.bricks.agent.label')}
          </label>
          <select
            className="input"
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('common.default')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.lang})
              </option>
            ))}
          </select>
          {!selectedAgent && (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              {t('pages.dashboard.setup.bricks.agent.description')}
            </p>
          )}
        </div>
      )}
    </BrickCard>,
    
    // Step 4: Leads
    <BrickCard
      key="leads"
      type="leads"
      title={t('pages.dashboard.setup.bricks.leads.label')}
      description={t('pages.dashboard.setup.bricks.leads.description')}
      completed={leads.length > 0}
      onAction={() => handleCreate('leads')}
      actionLabel={leads.length > 0 ? undefined : t('pages.dashboard.setup.import_now')}
    >
      {leads.length > 0 && (
        <div style={{ marginTop: 16, padding: 16, background: 'var(--green)', borderRadius: 8, color: 'white' }}>
          ✅ {t('pages.dashboard.setup.bricks.leads.label')} {t('common.completed')}
        </div>
      )}
    </BrickCard>
  ]
  
  const stepLabels = steps.map((_, index) => {
    const stepNumber = index + 1
    let label = ''
    if (stepNumber === 1) label = t('pages.dashboard.setup.bricks.number.label')
    else if (stepNumber === 2) label = t('pages.dashboard.setup.bricks.knowledge.label')
    else if (stepNumber === 3) label = t('pages.dashboard.setup.bricks.agent.label')
    else if (stepNumber === 4) label = t('pages.dashboard.setup.bricks.leads.label')
    return {
      label,
      completed: stepNumber < currentStep + 1
    }
  })
  
  const canGoNext = 
    (currentStep === 0 && selectedNumber && numbers.find(n => n.id === selectedNumber)?.verified) ||
    (currentStep === 1 && selectedKB) ||
    (currentStep === 2 && selectedAgent) ||
    (currentStep === 3 && leads.length > 0)
  
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
        title={t('pages.dashboard.setup.title')}
        subtitle={t('pages.dashboard.setup.description')}
      />
      
      <WizardContainer
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleComplete}
        canGoNext={canGoNext}
        stepLabels={stepLabels}
      />
    </div>
  )
}


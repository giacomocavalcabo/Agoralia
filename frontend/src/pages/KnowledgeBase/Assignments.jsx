import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../../components/ui/Card'
import { Button } from '../../components/ui/button'
import { useCanEdit } from '../../lib/workspace'
import { RequireRole } from '../../lib/workspace'
import { PrecedenceBanner, PrecedenceImpact } from '../../components/kb/PrecedenceBanner'
import { useAssignments, useAssignKb, useKbList } from '../../lib/kbApi'
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry'
import { CogIcon, PhoneIcon, UserIcon, ChartBarIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useDemoData } from '../../lib/useDemoData'

export default function Assignments() {
  const { t } = useTranslation('pages')
  const canEdit = useCanEdit()
  const [activeTab, setActiveTab] = useState('workspace')
  const [selectedKb, setSelectedKb] = useState({})
  const [conflictingAssignments, setConflictingAssignments] = useState([])
  const [confirmDialog, setConfirmDialog] = useState(null)
  const { isDemoMode } = useDemoData()
  
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments()
  const { data: kbList } = useKbList({})
  const assignKb = useAssignKb()
  
  // Mock data per demo - in produzione verrà da API
  const [mockAssignments, setMockAssignments] = useState({
    workspace_default: { kb_id: 'kb-1', name: 'Company KB Default' },
    number: [
      { scope_id: '+390123456789', kb_id: 'kb-2', name: 'Offer Pack IT' }
    ],
    campaign: [
      { scope_id: 'camp-1', kb_id: 'kb-3', name: 'Campaign KB' }
    ],
    agent: [
      { scope_id: 'agent-1', kb_id: 'kb-1', name: 'Company KB Default' }
    ]
  })

  const items = kbList?.items || [
    { id: 'kb-1', name: 'Company KB Default', kind: 'company' },
    { id: 'kb-2', name: 'Offer Pack IT', kind: 'offer_pack' },
    { id: 'kb-3', name: 'Campaign KB', kind: 'offer_pack' }
  ]

  const tabs = [
    { id: 'workspace', name: 'Workspace Default', icon: CogIcon },
    { id: 'number', name: 'Per Numero', icon: PhoneIcon },
    { id: 'campaign', name: 'Per Campagna', icon: ChartBarIcon },
    { id: 'agent', name: 'Per Agente', icon: UserIcon }
  ]

  const handleAssignKb = async (scope, scopeId, kbId) => {
    if (!canEdit) return
    
    setConfirmDialog({
              title: t('kb.assignments.confirm.assign_title'),
        description: t('kb.assignments.confirm.assign_desc'),
      onConfirm: () => performAssignment(scope, scopeId, kbId)
    })
  }

  const performAssignment = async (scope, scopeId, kbId) => {
    try {
      // Optimistic update
      const previousState = { ...mockAssignments }
      updateAssignmentsOptimistically(scope, scopeId, kbId)
      
      // API call
      await assignKb.mutateAsync({ scope, scope_id: scopeId, kb_id: kbId })
      
      // Success toast would go here
      setConfirmDialog(null)
    } catch (error) {
      // Rollback on failure
      setMockAssignments(previousState)
      if (import.meta.env.DEV) {
        console.error('Error assigning KB:', error)
      }
    }
  }

  const updateAssignmentsOptimistically = (scope, scopeId, kbId) => {
    const newAssignment = {
      scope,
      scope_id: scopeId,
      kb_id: kbId,
      name: items.find(kb => kb.id === kbId)?.name || 'Unknown KB'
    }

    setMockAssignments(prev => {
      if (scope === 'workspace_default') {
        return { ...prev, workspace_default: newAssignment }
      } else {
        const existing = prev[scope]?.filter(a => a.scope_id !== scopeId) || []
        const others = prev[scope]?.filter(a => a.scope_id !== scopeId) || []
        return { ...prev, [scope]: [...others, newAssignment] }
      }
    })

    // Calcola conflitti
    calculateConflicts(scope, scopeId, kbId)
    
    trackKbEvent(KB_EVENTS.ASSIGN_SET, {
      scope,
      scope_id: scopeId,
      kb_id: kbId
    })
  }

  const calculateConflicts = (scope, scopeId, kbId) => {
    const conflicts = []
    
    // Verifica se questa assegnazione sovrascrive altre
    if (scope === 'campaign') {
      // Campagna ha priorità massima
      const numberConflicts = mockAssignments.number?.filter(a => a.kb_id !== kbId) || []
      const agentConflicts = mockAssignments.agent?.filter(a => a.kb_id !== kbId) || []
      
      if (numberConflicts.length > 0) {
        conflicts.push({
          scope: 'number',
          description: 'Sovrascritto da campagna (priorità massima)'
        })
      }
      
      if (agentConflicts.length > 0) {
        conflicts.push({
          scope: 'agent',
          description: 'Sovrascritto da campagna (priorità massima)'
        })
      }
    } else if (scope === 'number') {
      // Numero ha priorità media
      const agentConflicts = mockAssignments.agent?.filter(a => a.kb_id !== kbId) || []
      
      if (agentConflicts.length > 0) {
        conflicts.push({
          scope: 'agent',
          description: 'Sovrascritto da numero (priorità media)'
        })
      }
    }
    
    setConflictingAssignments(conflicts)
  }

  const getScopeLabel = (scope, scopeId) => {
    switch (scope) {
      case 'workspace_default':
        return 'Default per tutto il workspace'
      case 'number':
        return `Numero ${scopeId}`
      case 'campaign':
        return `Campagna ${scopeId}`
      case 'agent':
        return `Agente ${scopeId}`
      default:
        return scopeId
    }
  }

  const getPrecedenceImpact = (scope) => {
    switch (scope) {
      case 'campaign':
        return 'high'
      case 'number':
        return 'medium'
      case 'agent':
        return 'low'
      default:
        return 'none'
    }
  }

  return (
    <RequireRole role="editor">
      <div className="px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{t('kb.assignments.title')}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('kb.assignments.description')}
              </p>
            </div>
          </div>

          {/* Precedence Banner */}
          <PrecedenceBanner />

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <tab.icon className="h-4 w-4" />
                    {tab.name}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* Workspace Default */}
            {activeTab === 'workspace' && (
              <Card title="Workspace Default">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>Questa KB verrà utilizzata come fallback per tutti i numeri, campagne e agenti che non hanno assegnazioni specifiche.</p>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">
                        {mockAssignments.workspace_default?.name || 'Nessuna KB assegnata'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {mockAssignments.workspace_default ? 'KB di default attiva' : 'Configura una KB di default'}
                      </div>
                    </div>
                    
                    <select
                      value={mockAssignments.workspace_default?.kb_id || ''}
                      onChange={(e) => handleAssignKb('workspace_default', null, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!canEdit}
                      data-testid="assign-select"
                    >
                      <option value="">Seleziona KB</option>
                      {items.map((kb) => (
                        <option key={kb.id} value={kb.id}>
                          {kb.name} ({kb.kind})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            )}

            {/* Per Numero */}
            {activeTab === 'number' && (
              <Card title="Per Numero">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>Assegna KB specifiche per singoli numeri di telefono. Queste hanno priorità sul workspace default ma sono sovrascritte dalle campagne.</p>
                  </div>
                  
                  <div className="space-y-3">
                    {mockAssignments.number?.map((assignment) => (
                      <div key={assignment.scope_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{getScopeLabel('number', assignment.scope_id)}</div>
                          <div className="text-sm text-gray-500">{assignment.name}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <PrecedenceImpact impact="medium" />
                          <select
                            value={assignment.kb_id}
                            onChange={(e) => handleAssignKb('number', assignment.scope_id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!canEdit}
                            data-testid="assign-select"
                          >
                            {items.map((kb) => (
                              <option key={kb.id} value={kb.id}>
                                {kb.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add new number assignment */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <div className="text-sm text-gray-500">
                        Aggiungi assegnazione per numero
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Funzionalità in fase di sviluppo
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Per Campagna */}
            {activeTab === 'campaign' && (
              <Card title="Per Campagna">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>Assegna KB specifiche per campagne. Queste hanno la priorità massima e sovrascrivono tutte le altre assegnazioni.</p>
                  </div>
                  
                  <div className="space-y-3">
                    {mockAssignments.campaign?.map((assignment) => (
                      <div key={assignment.scope_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{getScopeLabel('campaign', assignment.scope_id)}</div>
                          <div className="text-sm text-gray-500">{assignment.name}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <PrecedenceImpact impact="high" />
                          <select
                            value={assignment.kb_id}
                            onChange={(e) => handleAssignKb('campaign', assignment.scope_id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!canEdit}
                            data-testid="assign-select"
                          >
                            {items.map((kb) => (
                              <option key={kb.id} value={kb.id}>
                                {kb.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add new campaign assignment */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <div className="text-sm text-gray-500">
                        Aggiungi assegnazione per campagna
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Funzionalità in fase di sviluppo
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Per Agente */}
            {activeTab === 'agent' && (
              <Card title="Per Agente">
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>Assegna KB specifiche per agenti. Queste hanno la priorità più bassa e sono sovrascritte da numeri e campagne.</p>
                  </div>
                  
                  <div className="space-y-3">
                    {mockAssignments.agent?.map((assignment) => (
                      <div key={assignment.scope_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{getScopeLabel('agent', assignment.scope_id)}</div>
                          <div className="text-sm text-gray-500">{assignment.name}</div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <PrecedenceImpact impact="low" />
                          <select
                            value={assignment.kb_id}
                            onChange={(e) => handleAssignKb('agent', assignment.scope_id, e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!canEdit}
                            data-testid="assign-select"
                          >
                            {items.map((kb) => (
                              <option key={kb.id} value={kb.id}>
                                {kb.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add new agent assignment */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <div className="text-sm text-gray-500">
                        Aggiungi assegnazione per agente
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Funzionalità in fase di sviluppo
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Conflicts Warning */}
          {conflictingAssignments.length > 0 && (
            <Card title="Conflitti Rilevati" className="border-yellow-200 bg-yellow-50">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-800">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span className="font-medium">Attenzione: alcune assegnazioni verranno sovrascritte</span>
                </div>
                
                <ul className="text-sm text-yellow-700 space-y-1">
                  {conflictingAssignments.map((conflict, index) => (
                    <li key={index} className="ml-6">
                      • {conflict.description}
                    </li>
                  ))}
                </ul>
                
                <div className="text-xs text-yellow-600 mt-2">
                  Questo è il comportamento atteso secondo le regole di precedenza.
                </div>
              </div>
            </Card>
          )}

          {/* Summary */}
          <Card title="Riepilogo Assegnazioni">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium mb-2">Priorità (dall'alto verso il basso):</div>
                <ol className="list-decimal list-inside space-y-1 text-gray-600">
                  <li>Campagne (priorità massima)</li>
                  <li>Numeri di telefono</li>
                  <li>Agenti</li>
                  <li>Workspace default (fallback)</li>
                </ol>
              </div>
              
              <div>
                <div className="font-medium mb-2">Stato attuale:</div>
                <div className="space-y-1 text-gray-600">
                  <div>• Workspace default: {mockAssignments.workspace_default ? 'Configurato' : 'Non configurato'}</div>
                  <div>• Numeri: {mockAssignments.number?.length || 0} assegnazioni</div>
                  <div>• Campagne: {mockAssignments.campaign?.length || 0} assegnazioni</div>
                  <div>• Agenti: {mockAssignments.agent?.length || 0} assegnazioni</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={!!confirmDialog}
          title={confirmDialog?.title}
          description={confirmDialog?.description}
                  confirmText={t('kb.assignments.confirm.confirm')}
        cancelText={t('kb.assignments.confirm.cancel')} 
          onConfirm={confirmDialog?.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          data-testid="assign-confirm"
        />
      </div>
    </RequireRole>
  )
}

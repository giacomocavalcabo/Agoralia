import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { PrecedenceBanner, PrecedenceImpact } from '../../components/kb/PrecedenceBanner';
import { useAssignments, useAssignKb, useKbList } from '../../lib/kbApi';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import { CogIcon, PhoneIcon, UserIcon, ChartBarIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function Assignments() {
  const canEdit = useCanEdit();
  const [activeTab, setActiveTab] = useState('workspace');
  const [selectedKb, setSelectedKb] = useState({});
  const [conflictingAssignments, setConflictingAssignments] = useState([]);
  
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const { data: kbList } = useKbList({});
  const assignKb = useAssignKb();
  
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
  });

  const items = kbList?.items || [
    { id: 'kb-1', name: 'Company KB Default', kind: 'company' },
    { id: 'kb-2', name: 'Offer Pack IT', kind: 'offer_pack' },
    { id: 'kb-3', name: 'Campaign KB', kind: 'offer_pack' }
  ];

  const tabs = [
    { id: 'workspace', name: 'Workspace Default', icon: CogIcon },
    { id: 'number', name: 'Per Numero', icon: PhoneIcon },
    { id: 'campaign', name: 'Per Campagna', icon: ChartBarIcon },
    { id: 'agent', name: 'Per Agente', icon: UserIcon }
  ];

  const handleAssignKb = async (scope, scopeId, kbId) => {
    if (!canEdit) return;
    
    try {
      // Simula chiamata API
      const newAssignment = {
        scope,
        scope_id: scopeId,
        kb_id: kbId,
        name: items.find(kb => kb.id === kbId)?.name || 'Unknown KB'
      };

      // Aggiorna stato locale
      setMockAssignments(prev => {
        if (scope === 'workspace_default') {
          return { ...prev, workspace_default: newAssignment };
        } else {
          const existing = prev[scope]?.filter(a => a.scope_id === scopeId) || [];
          const others = prev[scope]?.filter(a => a.scope_id !== scopeId) || [];
          return { ...prev, [scope]: [...others, newAssignment] };
        }
      });

      // Calcola conflitti
      calculateConflicts(scope, scopeId, kbId);
      
      trackKbEvent(KB_EVENTS.ASSIGN_SET, {
        scope,
        scope_id: scopeId,
        kb_id: kbId
      });

      // In produzione: await assignKb.mutateAsync({ scope, scope_id: scopeId, kb_id: kbId });
    } catch (error) {
      console.error('Error assigning KB:', error);
    }
  };

  const calculateConflicts = (scope, scopeId, kbId) => {
    const conflicts = [];
    
    // Verifica se questa assegnazione sovrascrive altre
    if (scope === 'campaign') {
      // Campagna ha priorità massima
      const numberConflicts = mockAssignments.number?.filter(a => a.kb_id !== kbId) || [];
      const agentConflicts = mockAssignments.agent?.filter(a => a.kb_id !== kbId) || [];
      
      if (numberConflicts.length > 0) {
        conflicts.push({
          scope: 'number',
          description: 'Sovrascritto da campagna (priorità massima)'
        });
      }
      
      if (agentConflicts.length > 0) {
        conflicts.push({
          scope: 'agent', 
          description: 'Sovrascritto da campagna (priorità massima)'
        });
      }
    } else if (scope === 'number') {
      // Numero ha priorità su agente
      const agentConflicts = mockAssignments.agent?.filter(a => a.kb_id !== kbId) || [];
      
      if (agentConflicts.length > 0) {
        conflicts.push({
          scope: 'agent',
          description: 'Sovrascritto da numero (priorità superiore)'
        });
      }
    }
    
    setConflictingAssignments(conflicts);
  };

  const getAssignmentForScope = (scope, scopeId) => {
    if (scope === 'workspace_default') {
      return mockAssignments.workspace_default;
    }
    return mockAssignments[scope]?.find(a => a.scope_id === scopeId);
  };

  const getScopeLabel = (scope, scopeId) => {
    switch (scope) {
      case 'workspace_default':
        return 'Workspace Default';
      case 'number':
        return `Numero ${scopeId}`;
      case 'campaign':
        return `Campagna ${scopeId}`;
      case 'agent':
        return `Agente ${scopeId}`;
      default:
        return scopeId;
    }
  };

  const renderWorkspaceTab = () => (
    <Card title="Workspace Default KB">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            KB di default per il workspace
          </label>
          <select
            value={mockAssignments.workspace_default?.kb_id || ''}
            onChange={(e) => handleAssignKb('workspace_default', null, e.target.value)}
            disabled={!canEdit}
            className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
          >
            <option value="">Seleziona KB</option>
            {items.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} ({kb.kind})
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-gray-500">
          Questa KB sarà utilizzata come fallback quando non ci sono assegnazioni specifiche
        </p>
      </div>
    </Card>
  );

  const renderNumberTab = () => (
    <Card title="Assegnazioni per Numero">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Assegna KB specifiche per numeri di telefono (caller ID)
        </p>
        
        <div className="space-y-3">
          {['+390123456789', '+390987654321'].map((number) => {
            const assignment = getAssignmentForScope('number', number);
            return (
              <div key={number} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{number}</div>
                  <div className="text-sm text-gray-500">Caller ID</div>
                </div>
                <select
                  value={assignment?.kb_id || ''}
                  onChange={(e) => handleAssignKb('number', number, e.target.value)}
                  disabled={!canEdit}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                >
                  <option value="">Usa default</option>
                  {items.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
                {assignment && (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

  const renderCampaignTab = () => (
    <Card title="Assegnazioni per Campagna">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Assegna KB specifiche per campagne di marketing
        </p>
        
        <div className="space-y-3">
          {['camp-1', 'camp-2'].map((campaign) => {
            const assignment = getAssignmentForScope('campaign', campaign);
            return (
              <div key={campaign} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{campaign}</div>
                  <div className="text-sm text-gray-500">Campagna Marketing</div>
                </div>
                <select
                  value={assignment?.kb_id || ''}
                  onChange={(e) => handleAssignKb('campaign', campaign, e.target.value)}
                  disabled={!canEdit}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                >
                  <option value="">Usa default</option>
                  {items.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
                {assignment && (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

  const renderAgentTab = () => (
    <Card title="Assegnazioni per Agente">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Assegna KB specifiche per agenti di vendita
        </p>
        
        <div className="space-y-3">
          {['agent-1', 'agent-2'].map((agent) => {
            const assignment = getAssignmentForScope('agent', agent);
            return (
              <div key={agent} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{agent}</div>
                  <div className="text-sm text-gray-500">Agente Vendite</div>
                </div>
                <select
                  value={assignment?.kb_id || ''}
                  onChange={(e) => handleAssignKb('agent', agent, e.target.value)}
                  disabled={!canEdit}
                  className="px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                >
                  <option value="">Usa default</option>
                  {items.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name}
                    </option>
                  ))}
                </select>
                {assignment && (
                  <CheckIcon className="h-5 w-5 text-green-600" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Assignments</h1>
            <p className="text-sm text-gray-500">
              Configura la KB per numeri, campagne e agenti
            </p>
          </div>
        </div>
        
        <PrecedenceBanner />
        
        {/* Conflitti di Precedenza */}
        {conflictingAssignments.length > 0 && (
          <PrecedenceImpact 
            currentScope={activeTab}
            conflictingAssignments={conflictingAssignments}
          />
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'workspace' && renderWorkspaceTab()}
          {activeTab === 'number' && renderNumberTab()}
          {activeTab === 'campaign' && renderCampaignTab()}
          {activeTab === 'agent' && renderAgentTab()}
        </div>

        {/* Summary */}
        <Card title="Riepilogo Assegnazioni">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tabs.map((tab) => {
              const count = tab.id === 'workspace' ? 
                (mockAssignments.workspace_default ? 1 : 0) :
                mockAssignments[tab.id]?.length || 0;
              
              return (
                <div key={tab.id} className="text-center p-4 border rounded-lg">
                  <tab.icon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <div className="text-2xl font-semibold">{count}</div>
                  <div className="text-sm text-gray-500">{tab.name}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}

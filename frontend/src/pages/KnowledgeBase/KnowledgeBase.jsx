import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import Card from '../../components/ui/Card'
import { Button } from '../../components/ui/button'
import { useKbList, useCreateKb } from '../../lib/kbApi'
import { CompletenessMeter } from '../../components/kb/CompletenessMeter'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry'

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  
  // Fetch KB overview data
  const { data: kbData, isLoading } = useQuery({
    queryKey: ['kb-overview'],
    queryFn: () => api.get('/kb/progress'),
    staleTime: 30000
  })
  
  // Fetch KB list using new hook
  const { data: kbList } = useKbList({});
  const createKb = useCreateKb();
  const items = kbList?.items ?? [];
  
  const company = items.find(i => i.kind === 'company');
  const offers = items.filter(i => i.kind === 'offer_pack');

  const handleCreateCompany = async () => {
    if (isCreatingCompany) return;
    
    setIsCreatingCompany(true);
    try {
      const result = await createKb.mutateAsync({
        kind: 'company',
        name: 'Company Knowledge Base',
        type: 'company',
        locale_default: 'it-IT'
      });
      
      if (result?.id) {
        trackKbEvent(KB_EVENTS.CREATE, { kind: 'company', type: 'company', success: true });
        navigate(`/knowledge/company/${result.id}`);
      }
    } catch (error) {
      console.error('Error creating company KB:', error);
      trackKbEvent(KB_EVENTS.CREATE, { kind: 'company', type: 'company', success: false });
      // TODO: Show error toast
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleCreateOfferPack = () => {
    navigate('/knowledge/offers?new=true');
  };

  const handleImport = () => {
    navigate('/knowledge/imports');
  };

  const handleAssignments = () => {
    navigate('/knowledge/assignments');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Knowledge</h1>
        <div className="flex gap-2">
          <Button onClick={handleImport} variant="outline">
            <CogIcon className="h-4 w-4 mr-2" />
            Importa
          </Button>
          <Button onClick={handleCreateOfferPack} variant="secondary">
            <PlusIcon className="h-4 w-4 mr-2" />
            Nuovo Offer Pack
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title={
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            Company
          </div>
        }>
            {company ? (
              <>
                <CompletenessMeter 
                  completeness={company.completeness_pct || 0}
                  freshness={company.freshness_score || 0}
                  lastUpdated={company.updated_at}
                  showDetails={false}
                />
                <div className="mt-3 flex gap-2">
                  <Button 
                    onClick={() => navigate(`/knowledge/company/${company.id}`)}
                    size="sm"
                  >
                    Apri
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Crea la knowledge base della tua azienda
                </p>
                <Button 
                  onClick={handleCreateCompany} 
                  size="sm"
                  disabled={isCreatingCompany}
                >
                  {isCreatingCompany ? 'Creazione...' : 'Crea Company KB'}
                </Button>
              </>
            )}
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Offer Packs
          </div>
        }>
          <div className="text-3xl font-semibold">{offers.length}</div>
          <p className="text-sm text-gray-500 mt-1">
            {offers.length === 0 ? 'Nessun offer pack creato' : 'Offer pack disponibili'}
          </p>
          <Button className="mt-3" onClick={handleCreateOfferPack} size="sm">
            {offers.length === 0 ? 'Crea il primo' : 'Gestisci'}
          </Button>
        </Card>

        <Card title={
          <div className="flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            Assignments
          </div>
        }>
          <p className="text-sm text-gray-500 mb-3">
            Configura la KB per numeri, campagne e agenti
          </p>
          <Button className="mt-3" onClick={handleAssignments} size="sm">
            Apri
          </Button>
        </Card>
      </div>

      {/* Quick Stats */}
      {kbData && (
        <Card title="Progresso Globale">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-semibold">{kbData.total_kbs || 0}</div>
              <div className="text-sm text-gray-500">Knowledge Base</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{kbData.avg_completeness || 0}%</div>
              <div className="text-sm text-gray-500">Completezza Media</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{kbData.published_count || 0}</div>
              <div className="text-sm text-gray-500">Pubblicate</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

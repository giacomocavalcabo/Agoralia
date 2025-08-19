import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useKbDetail } from '../../lib/kbApi';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { ArrowLeftIcon, PlusIcon, DocumentTextIcon, CogIcon, CheckIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function OfferPackDetail() {
  const { offerPackId } = useParams();
  const canEdit = useCanEdit();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: kbData, isLoading } = useKbDetail(offerPackId);
  
  // Mock data per demo - in produzione verrà da API
  const [offerPack, setOfferPack] = useState({
    id: offerPackId,
    name: 'SaaS Starter Pack',
    description: 'Pacchetto base per startup SaaS con soluzioni complete per la gestione aziendale',
    type: 'saas',
    status: 'published',
    completeness_pct: 85,
    freshness_score: 15,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    sections: [
      {
        id: 'sec-1',
        title: 'Overview Prodotto',
        content: 'Descrizione completa del prodotto SaaS con caratteristiche principali',
        status: 'published',
        last_updated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        completeness: 95
      },
      {
        id: 'sec-2',
        title: 'Pricing e Piani',
        content: 'Struttura dei prezzi e piani disponibili per diverse dimensioni aziendali',
        status: 'published',
        last_updated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        completeness: 88
      },
      {
        id: 'sec-3',
        title: 'Integrazioni',
        content: 'API e integrazioni disponibili con sistemi esterni',
        status: 'draft',
        last_updated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        completeness: 45
      },
      {
        id: 'sec-4',
        title: 'Supporto e Documentazione',
        content: 'Canali di supporto e documentazione tecnica disponibile',
        status: 'published',
        last_updated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        completeness: 92
      }
    ],
    assignments: [
      { scope: 'campaign', scope_id: 'camp-saas-2024', name: 'Campagna SaaS Q4 2024' },
      { scope: 'number', scope_id: '+390123456789', name: 'Numero principale' }
    ]
  });

  // Aggiorna offerPack quando i dati arrivano dall'API
  useEffect(() => {
    if (kbData) {
      setOfferPack(kbData);
    }
  }, [kbData]);

  const handleSectionStatusChange = (sectionId, newStatus) => {
    setOfferPack(prev => ({
      ...prev,
      sections: prev.sections.map(sec => 
        sec.id === sectionId ? { ...sec, status: newStatus } : sec
      )
    }));
    
    trackKbEvent(KB_EVENTS.SECTION_UPDATE, {
      kb_id: offerPackId,
      section_id: sectionId,
      status: newStatus
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSectionIcon = (status) => {
    switch (status) {
      case 'published': return <CheckIcon className="h-4 w-4 text-green-600" />;
      case 'draft': return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      case 'archived': return <DocumentTextIcon className="h-4 w-4 text-gray-600" />;
      default: return <DocumentTextIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-200 h-8 rounded w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="animate-pulse bg-gray-200 h-64 rounded"></div>
          </div>
          <aside className="space-y-3">
            <div className="animate-pulse bg-gray-200 h-32 rounded"></div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/knowledge/offers">
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Indietro
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold">{offerPack.name}</h1>
              <p className="text-sm text-gray-500">
                Offer Pack • {offerPack.type} • {offerPack.status}
              </p>
            </div>
          </div>
          {canEdit && (
            <Link to={`/knowledge/offers/${offerPackId}/edit`}>
              <Button>
                <CogIcon className="h-4 w-4 mr-2" />
                Modifica
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sections">Sezioni</TabsTrigger>
                <TabsTrigger value="assignments">Assegnazioni</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <Card title="Descrizione">
                  <p className="text-gray-700 leading-relaxed">
                    {offerPack.description}
                  </p>
                </Card>
                
                <Card title="Caratteristiche" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tipo</label>
                      <span className="text-sm text-gray-900 capitalize">{offerPack.type}</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(offerPack.status)}`}>
                        {offerPack.status}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Creato</label>
                      <span className="text-sm text-gray-900">
                        {new Date(offerPack.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ultimo aggiornamento</label>
                      <span className="text-sm text-gray-900">
                        {new Date(offerPack.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="sections" className="mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Sezioni ({offerPack.sections.length})</h3>
                    {canEdit && (
                      <Button size="sm">
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Nuova Sezione
                      </Button>
                    )}
                  </div>
                  
                  {offerPack.sections.map((section) => (
                    <Card key={section.id} className="hover:shadow-md transition-shadow">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getSectionIcon(section.status)}
                            <h4 className="font-medium">{section.title}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(section.status)}`}>
                              {section.status}
                            </span>
                          </div>
                          {canEdit && (
                            <select
                              value={section.status}
                              onChange={(e) => handleSectionStatusChange(section.id, e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-300 rounded"
                            >
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="archived">Archived</option>
                            </select>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {section.content}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div>Completeness: {section.completeness}%</div>
                          <div>Aggiornato: {new Date(section.last_updated).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="assignments" className="mt-6">
                <Card title="Assegnazioni attive">
                  {offerPack.assignments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Nessuna assegnazione attiva</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Questo offer pack non è assegnato a nessun scope specifico
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {offerPack.assignments.map((assignment, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{assignment.name}</div>
                            <div className="text-sm text-gray-500">
                              {assignment.scope}: {assignment.scope_id}
                            </div>
                          </div>
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            Attivo
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <aside className="space-y-3">
            <CompletenessMeter 
              completeness={offerPack.completeness_pct}
              freshness={offerPack.freshness_score}
              lastUpdated={offerPack.updated_at}
            />
            
            <Card title="Metadati">
              <div className="text-xs text-gray-500 space-y-1">
                <div>ID: {offerPack.id}</div>
                <div>Creato: {new Date(offerPack.created_at).toLocaleDateString()}</div>
                <div>Aggiornato: {new Date(offerPack.updated_at).toLocaleDateString()}</div>
                {offerPack.published_at && (
                  <div>Pubblicato: {new Date(offerPack.published_at).toLocaleDateString()}</div>
                )}
                <div>Sezioni: {offerPack.sections.length}</div>
                <div>Assegnazioni: {offerPack.assignments.length}</div>
              </div>
            </Card>
            
            <Card title="Azioni rapide">
              <div className="space-y-2">
                <Button variant="outline" className="w-full" size="sm">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Esporta PDF
                </Button>
                <Button variant="outline" className="w-full" size="sm">
                  <CogIcon className="h-4 w-4 mr-2" />
                  Duplica
                </Button>
                {offerPack.status === 'published' && (
                  <Button variant="outline" className="w-full" size="sm">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Archivia
                  </Button>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </RequireRole>
  );
}

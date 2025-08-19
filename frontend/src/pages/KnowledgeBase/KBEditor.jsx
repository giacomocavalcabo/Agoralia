import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useKbDetail, useUpdateKb, useCreateKb } from '../../lib/kbApi';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { useAutosave } from '../../lib/useAutosave';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { PlusIcon, DocumentTextIcon, CogIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function KBEditor({ kind = 'company' }) {
  const { kbId } = useParams();
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const [currentTab, setCurrentTab] = useState('overview');
  const [isCreating, setIsCreating] = useState(!kbId);
  
  // Mock data per demo - in produzione verrà da API
  const [kb, setKb] = useState(isCreating ? {
    name: '',
    description: '',
    type: kind === 'company' ? 'company' : 'other',
    locale_default: 'it-IT',
    status: 'draft',
    completeness_pct: 0,
    freshness_score: 0
  } : null);

  const { data: kbData, isLoading } = useKbDetail(kbId);
  const updateKb = useUpdateKb();
  const createKb = useCreateKb();

  // Aggiorna kb quando i dati arrivano dall'API
  useEffect(() => {
    if (kbData && !isCreating) {
      setKb(kbData);
    }
  }, [kbData, isCreating]);

  // Autosave per i campi principali
  const nameAutosave = useAutosave(kbId, 'name', kb?.name || '');
  const descriptionAutosave = useAutosave(kbId, 'description', kb?.description || '');
  const typeAutosave = useAutosave(kbId, 'type', kb?.type || '');

  const handlePublish = async () => {
    if (!kb || !canEdit) return;
    
    // Verifica soglia completeness
    if (kb.completeness_pct < 60) {
      alert('Completeness minima del 60% richiesta per pubblicare');
      return;
    }
    
    try {
      if (isCreating) {
        const result = await createKb.mutateAsync({
          kind,
          name: kb.name,
          type: kb.type,
          locale_default: kb.locale_default
        });
        
        if (result?.id) {
          setIsCreating(false);
          navigate(`/knowledge/${kind === 'company' ? 'company' : 'offers'}/${result.id}`);
          trackKbEvent(KB_EVENTS.CREATE, { kind, type: kb.type, success: true });
        }
      } else {
        await updateKb.mutateAsync({
          id: kb.id,
          payload: { status: kb.status === 'published' ? 'draft' : 'published' }
        });
        
        setKb(prev => ({ ...prev, status: prev.status === 'published' ? 'draft' : 'published' }));
        trackKbEvent(KB_EVENTS.PUBLISH, { kb_id: kb.id, success: true });
      }
    } catch (error) {
      console.error('Error updating KB:', error);
      trackKbEvent(KB_EVENTS.PUBLISH, { kb_id: kb?.id, success: false });
    }
  };

  const handleFieldChange = (field, value) => {
    setKb(prev => ({ ...prev, [field]: value }));
    
    // Trigger autosave se non stiamo creando
    if (!isCreating) {
      switch (field) {
        case 'name':
          nameAutosave.handleChange(value);
          break;
        case 'description':
          descriptionAutosave.handleChange(value);
          break;
        case 'type':
          typeAutosave.handleChange(value);
          break;
      }
    }
  };

  const getMissingFields = () => {
    const required = ['name', 'description'];
    return required.filter(field => !kb?.[field] || kb[field].trim() === '');
  };

  const missingFields = getMissingFields();
  const canPublish = kb && kb.completeness_pct >= 60 && missingFields.length === 0;

  if (isLoading && !isCreating) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {isCreating ? `Crea ${kind === 'company' ? 'Company' : 'Offer Pack'}` : kb?.name}
            </h1>
            <p className="text-sm text-gray-500">
              {kind === 'company' ? 'Company Knowledge Base' : 'Offer Pack'} • {kb?.status || 'draft'}
            </p>
          </div>
          {canEdit && (
            <Button 
              onClick={handlePublish}
              disabled={updateKb.isPending || createKb.isPending || !canPublish}
              variant={kb?.status === 'published' ? 'outline' : 'default'}
            >
              {updateKb.isPending || createKb.isPending ? 'Aggiornamento...' : 
               isCreating ? 'Crea' :
               kb?.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          )}
        </div>

        {/* Missing Fields Warning */}
        {missingFields.length > 0 && (
          <Card title="Campi Obbligatori Mancanti" className="border-yellow-200 bg-yellow-50">
            <div className="text-sm text-yellow-800">
              <p className="mb-2">I seguenti campi sono richiesti per pubblicare:</p>
              <ul className="list-disc list-inside space-y-1">
                {missingFields.map(field => (
                  <li key={field} className="capitalize">
                    {field === 'name' ? 'Nome' : field === 'description' ? 'Descrizione' : field}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sections">Sections</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <Card title="Informazioni principali">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={kb?.name || ''}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                        placeholder="Inserisci il nome della KB"
                      />
                      {nameAutosave.isSaving && (
                        <div className="text-xs text-blue-600 mt-1">Salvando...</div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione *
                      </label>
                      <textarea
                        value={kb?.description || ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        disabled={!canEdit}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                        placeholder="Descrivi la knowledge base"
                      />
                      {descriptionAutosave.isSaving && (
                        <div className="text-xs text-blue-600 mt-1">Salvando...</div>
                      )}
                    </div>
                    
                    {kind === 'offer_pack' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo
                        </label>
                        <select
                          value={kb?.type || ''}
                          onChange={(e) => handleFieldChange('type', e.target.value)}
                          disabled={!canEdit}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                        >
                          <option value="">Seleziona tipo</option>
                          <option value="saas">SaaS</option>
                          <option value="consulting">Consulting</option>
                          <option value="physical">Physical Product</option>
                          <option value="marketplace">Marketplace</option>
                          <option value="logistics">Logistics</option>
                          <option value="manufacturing">Manufacturing</option>
                          <option value="other">Other</option>
                        </select>
                        {typeAutosave.isSaving && (
                          <div className="text-xs text-blue-600 mt-1">Salvando...</div>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lingua di default
                      </label>
                      <select
                        value={kb?.locale_default || 'it-IT'}
                        onChange={(e) => handleFieldChange('locale_default', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-50"
                      >
                        <option value="it-IT">Italiano</option>
                        <option value="en-US">English</option>
                      </select>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="sections" className="mt-6">
                <Card title="Sezioni">
                  <div className="text-center py-12">
                    <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500">Gestione delle sezioni in fase di sviluppo</p>
                    <p className="text-sm text-gray-400 mt-1">Le sezioni verranno implementate nella prossima fase</p>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="mt-6">
                <Card title="Cronologia modifiche">
                  <div className="text-center py-12">
                    <CogIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500">Cronologia modifiche in fase di sviluppo</p>
                    <p className="text-sm text-gray-400 mt-1">Il versioning verrà implementato nella prossima fase</p>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <aside className="space-y-3">
            <CompletenessMeter 
              completeness={kb?.completeness_pct || 0}
              freshness={kb?.freshness_score || 0}
              lastUpdated={kb?.updated_at}
            />
            
            <Card title="Metadati">
              <div className="text-xs text-gray-500 space-y-1">
                <div>ID: {kb?.id || 'Nuovo'}</div>
                <div>Creato: {kb?.created_at ? new Date(kb.created_at).toLocaleDateString() : 'Non ancora creato'}</div>
                {kb?.updated_at && (
                  <div>Aggiornato: {new Date(kb.updated_at).toLocaleDateString()}</div>
                )}
                {kb?.published_at && (
                  <div>Pubblicato: {new Date(kb.published_at).toLocaleDateString()}</div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </RequireRole>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useKbDetail, useUpdateKb, useCreateKb } from '../../lib/kbApi';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { useAutosave } from '../../lib/useAutosave';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { PlusIcon, DocumentTextIcon, CogIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline';

// Template per Company KB
const COMPANY_SECTIONS = [
  { key: 'purpose', title: 'Scopo e Mission', required: true },
  { key: 'vision', title: 'Vision', required: true },
  { key: 'icp', title: 'Ideal Customer Profile', required: true },
  { key: 'operating_areas', title: 'Aree Operative', required: true },
  { key: 'brand_voice', title: 'Tono di Brand', required: false },
  { key: 'contacts', title: 'Contatti', required: true },
  { key: 'policies', title: 'Politiche', required: false },
  { key: 'legal', title: 'Informazioni Legali', required: false }
];

export default function KBEditor({ kind = 'company' }) {
  const { kbId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const [currentTab, setCurrentTab] = useState('overview');
  const [isCreating, setIsCreating] = useState(!kbId);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState({});
  
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
      // Popola sezioni e campi se disponibili
      if (kbData.sections) {
        setSections(kbData.sections);
      }
      if (kbData.fields) {
        setFields(kbData.fields);
      }
    }
  }, [kbData, isCreating]);

  // Inizializza sezioni per Company KB
  useEffect(() => {
    if (kind === 'company' && isCreating) {
      setSections(COMPANY_SECTIONS.map(section => ({
        ...section,
        content: '',
        completeness_pct: 0
      })));
    }
  }, [kind, isCreating]);

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

  const handleSectionChange = (sectionKey, content) => {
    setSections(prev => prev.map(section => 
      section.key === sectionKey 
        ? { ...section, content, completeness_pct: content ? Math.min(100, content.length * 2) : 0 }
        : section
    ));
    
    // Aggiorna fields per compatibilità
    setFields(prev => ({
      ...prev,
      [sectionKey]: content
    }));
  };

  const calculateCompleteness = () => {
    if (sections.length === 0) return 0;
    const total = sections.reduce((sum, section) => sum + section.completeness_pct, 0);
    return Math.round(total / sections.length);
  };

  const missingFields = sections.filter(section => section.required && !section.content);

  if (isLoading && !isCreating) {
    return <div className="animate-pulse">Caricamento...</div>;
  }

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {isCreating ? `Crea ${kind === 'company' ? 'Company' : 'Offer Pack'} KB` : kb?.name}
            </h1>
            {!isCreating && (
              <p className="text-sm text-gray-500 mt-1">
                ID: {kb?.id} • Ultimo aggiornamento: {kb?.updated_at ? new Date(kb.updated_at).toLocaleDateString('it-IT') : 'N/A'}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/knowledge')}>
              Indietro
            </Button>
            {!isCreating && (
              <Button 
                onClick={handlePublish}
                disabled={kb?.completeness_pct < 60}
                variant={kb?.status === 'published' ? 'outline' : 'default'}
              >
                {kb?.status === 'published' ? 'Rimuovi pubblicazione' : 'Pubblica'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="sections">Sezioni</TabsTrigger>
                <TabsTrigger value="history">Cronologia</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <Card title="Informazioni Base">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={kb?.name || ''}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome della Knowledge Base"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo
                      </label>
                      <select
                        value={kb?.type || ''}
                        onChange={(e) => handleFieldChange('type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!canEdit}
                      >
                        <option value="">Seleziona tipo</option>
                        <option value="company">Company</option>
                        <option value="saas">SaaS</option>
                        <option value="consulting">Consulting</option>
                        <option value="physical">Physical Product</option>
                        <option value="marketplace">Marketplace</option>
                        <option value="logistics">Logistics</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione
                      </label>
                      <textarea
                        value={kb?.description || ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Descrizione della Knowledge Base"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="sections" className="space-y-4">
                <Card title="Sezioni">
                  {sections.map((section) => (
                    <div key={section.key} className="border-b border-gray-200 py-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{section.title}</h3>
                          {section.required && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Obbligatorio
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {section.completeness_pct}% completo
                        </div>
                      </div>
                      <textarea
                        value={section.content || ''}
                        onChange={(e) => handleSectionChange(section.key, e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Inserisci ${section.title.toLowerCase()}...`}
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                <Card title="Cronologia Modifiche">
                  <p className="text-sm text-gray-500">
                    Cronologia delle modifiche non ancora implementata
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card title="Stato">
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-600 mb-2">Completezza</div>
                  <div className="text-2xl font-semibold">{calculateCompleteness()}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${calculateCompleteness()}%` }}
                    ></div>
                  </div>
                </div>
                
                {!isCreating && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Status</div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      kb?.status === 'published' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {kb?.status || 'draft'}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {missingFields.length > 0 && (
              <Card title="Campi Obbligatori Mancanti" className="border-yellow-200 bg-yellow-50">
                <ul className="text-sm text-yellow-800 space-y-1">
                  {missingFields.map(field => (
                    <li key={field.key} className="flex items-center gap-2">
                      <PencilIcon className="h-4 w-4" />
                      {field.title}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {!isCreating && (
              <Card title="Azioni Rapide">
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setCurrentTab('sections')}
                  >
                    Modifica Sezioni
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate('/knowledge/imports')}
                  >
                    Importa Contenuto
                  </Button>
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </RequireRole>
  );
}

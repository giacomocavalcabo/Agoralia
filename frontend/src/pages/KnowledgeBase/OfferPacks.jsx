import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/button';
import { useCanEdit } from '../../lib/workspace';
import { RequireRole } from '../../lib/workspace';
import { CompletenessMeter } from '../../components/kb/CompletenessMeter';
import { useKbList } from '../../lib/kbApi';
import { trackKbEvent, KB_EVENTS } from '../../lib/telemetry';
import { PlusIcon, DocumentTextIcon, CogIcon, ChartBarIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export default function OfferPacks() {
  const canEdit = useCanEdit();
  const [selectedType, setSelectedType] = useState('all');
  
  const { data: kbList, isLoading } = useKbList({ kind: 'offer_pack' });
  
  // Mock data per demo - in produzione verrà da API
  const mockOfferPacks = [
    {
      id: 'op-1',
      name: 'SaaS Starter Pack',
      description: 'Pacchetto base per startup SaaS',
      type: 'saas',
      status: 'published',
      completeness_pct: 85,
      freshness_score: 15,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      sections_count: 12,
      assignments_count: 3
    },
    {
      id: 'op-2',
      name: 'Consulting Premium',
      description: 'Servizi di consulenza enterprise',
      type: 'consulting',
      status: 'draft',
      completeness_pct: 45,
      freshness_score: 45,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      sections_count: 8,
      assignments_count: 1
    },
    {
      id: 'op-3',
      name: 'Manufacturing Solutions',
      description: 'Soluzioni per industria manifatturiera',
      type: 'manufacturing',
      status: 'published',
      completeness_pct: 92,
      freshness_score: 8,
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      sections_count: 18,
      assignments_count: 5
    }
  ];

  const offerPacks = mockOfferPacks.filter(op => 
    selectedType === 'all' || op.type === selectedType
  );

  const types = [
    { id: 'all', name: 'Tutti', count: mockOfferPacks.length },
    { id: 'saas', name: 'SaaS', count: mockOfferPacks.filter(op => op.type === 'saas').length },
    { id: 'consulting', name: 'Consulting', count: mockOfferPacks.filter(op => op.type === 'consulting').length },
    { id: 'manufacturing', name: 'Manufacturing', count: mockOfferPacks.filter(op => op.type === 'manufacturing').length },
    { id: 'logistics', name: 'Logistics', count: mockOfferPacks.filter(op => op.type === 'logistics').length }
  ];

  const getTypeIcon = (type) => {
    switch (type) {
      case 'saas': return <CogIcon className="h-4 w-4" />;
      case 'consulting': return <ChartBarIcon className="h-4 w-4" />;
      case 'manufacturing': return <CogIcon className="h-4 w-4" />;
      case 'logistics': return <GlobeAltIcon className="h-4 w-4" />;
      default: return <DocumentTextIcon className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateOfferPack = () => {
    trackKbEvent(KB_EVENTS.CREATE, { kind: 'offer_pack' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse bg-gray-200 h-8 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-64 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <RequireRole role="editor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Offer Packs</h1>
            <p className="text-sm text-gray-500">
              Gestisci i pacchetti offerta per la Knowledge Base
            </p>
          </div>
          {canEdit && (
            <Link to="/knowledge/offers/new">
              <Button onClick={handleCreateOfferPack}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Nuovo Offer Pack
              </Button>
            </Link>
          )}
        </div>

        {/* Type Filter */}
        <Card title="Filtri">
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedType === type.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.name} ({type.count})
              </button>
            ))}
          </div>
        </Card>

        {/* Offer Packs Grid */}
        {offerPacks.length === 0 ? (
          <Card title="Nessun Offer Pack trovato">
            <div className="text-center py-12">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500">Nessun offer pack trovato</p>
              <p className="text-sm text-gray-400 mt-1">
                {selectedType === 'all' 
                  ? 'Crea il tuo primo offer pack' 
                  : `Nessun offer pack di tipo "${types.find(t => t.id === selectedType)?.name}"`
                }
              </p>
              {canEdit && (
                <Link to="/knowledge/offers/new">
                  <Button className="mt-4" onClick={handleCreateOfferPack}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Crea Offer Pack
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerPacks.map((offerPack) => (
              <Card key={offerPack.id} className="hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(offerPack.type)}
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {offerPack.type}
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(offerPack.status)}`}>
                      {offerPack.status}
                    </span>
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{offerPack.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {offerPack.description}
                    </p>
                  </div>

                  {/* Completeness */}
                  <CompletenessMeter 
                    completeness={offerPack.completeness_pct}
                    freshness={offerPack.freshness_score}
                    lastUpdated={offerPack.updated_at}
                    compact
                  />

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Sezioni</div>
                      <div className="font-medium">{offerPack.sections_count}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Assegnazioni</div>
                      <div className="font-medium">{offerPack.assignments_count}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Link 
                      to={`/knowledge/offers/${offerPack.id}`}
                      className="flex-1"
                    >
                      <Button variant="outline" className="w-full">
                        Dettagli
                      </Button>
                    </Link>
                    {canEdit && (
                      <Link to={`/knowledge/offers/${offerPack.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <CogIcon className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <Card title="Statistiche">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-semibold text-blue-600">
                {mockOfferPacks.length}
              </div>
              <div className="text-sm text-gray-500">Totali</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-semibold text-green-600">
                {mockOfferPacks.filter(op => op.status === 'published').length}
              </div>
              <div className="text-sm text-gray-500">Pubblicati</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-semibold text-yellow-600">
                {mockOfferPacks.filter(op => op.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-500">Bozze</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-semibold text-gray-600">
                {Math.round(mockOfferPacks.reduce((acc, op) => acc + op.completeness_pct, 0) / mockOfferPacks.length)}
              </div>
              <div className="text-sm text-gray-500">Completeness Media</div>
            </div>
          </div>
        </Card>
      </div>
    </RequireRole>
  );
}

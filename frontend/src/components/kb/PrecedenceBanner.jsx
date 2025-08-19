import { InformationCircleIcon } from '@heroicons/react/24/outline';

export function PrecedenceBanner() {
  const precedence = [
    { level: 1, scope: 'Campagna', description: 'Priorità massima', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { level: 2, scope: 'Numero', description: 'Override per caller ID', color: 'bg-green-100 text-green-800 border-green-200' },
    { level: 3, scope: 'Agente', description: 'Override per agente specifico', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    { level: 4, scope: 'Workspace Default', description: 'Fallback generale', color: 'bg-gray-100 text-gray-800 border-gray-200' }
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Ordine di Precedenza KB
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            Le assegnazioni seguono questo ordine di priorità. Una KB assegnata a un livello superiore 
            sovrascrive quelle dei livelli inferiori.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {precedence.map((item) => (
              <div key={item.level} className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${item.color}`}>
                  {item.level}
                </span>
                <div>
                  <span className="text-sm font-medium text-blue-900">{item.scope}</span>
                  <span className="text-xs text-blue-600 block">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrecedenceImpact({ currentScope, currentKbId, conflictingAssignments = [] }) {
  if (conflictingAssignments.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
      <h4 className="text-sm font-medium text-yellow-900 mb-2">
        Impatto sulla Precedenza
      </h4>
      <div className="space-y-2">
        {conflictingAssignments.map((conflict) => (
          <div key={conflict.id} className="text-sm text-yellow-700">
            <span className="font-medium">{conflict.scope}:</span> {conflict.description}
          </div>
        ))}
      </div>
    </div>
  );
}

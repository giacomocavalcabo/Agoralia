import { InformationCircleIcon } from '@heroicons/react/24/outline';

export function PrecedenceBanner() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <div className="font-medium mb-1">Ordine di Precedenza KB</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                1° Priorità
              </span>
              <span>Campagne (sovrascrivono tutto)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                2° Priorità
              </span>
              <span>Numeri di telefono</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                3° Priorità
              </span>
              <span>Agenti</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Fallback
              </span>
              <span>Workspace Default</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrecedenceImpact({ impact = 'none' }) {
  const getImpactConfig = (impact) => {
    switch (impact) {
      case 'high':
        return {
          label: 'Alta Priorità',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200'
        };
      case 'medium':
        return {
          label: 'Media Priorità',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          borderColor: 'border-orange-200'
        };
      case 'low':
        return {
          label: 'Bassa Priorità',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200'
        };
      default:
        return {
          label: 'Nessuna Priorità',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-800',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getImpactConfig(impact);

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor} ${config.borderColor} border`}>
      {config.label}
    </span>
  );
}

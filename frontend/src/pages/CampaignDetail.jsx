import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCampaigns } from '../lib/useCampaigns'
import Leads from './Leads' // riuso tabella Leads

export default function CampaignDetail(){
  const { id } = useParams();
  const { t } = useTranslation('pages');
  // riutilizzo la query delle liste e prendo l'item
  const { data } = useCampaigns({ page:1, perPage:200 }); // sufficiente per trovare l'id
  const campaign = (data?.results || []).find(c => c.id === id);

  if (!campaign) {
    return <div className="text-sm text-gray-600">{t('campaigns.detail.not_found')}</div>;
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{campaign.name}</h1>
        <p className="text-sm text-gray-500">{t('campaigns.detail.subtitle')}</p>
      </div>
      {/* Tab "Leads" filtrata dal segment salvato sulla campaign */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-gray-700">{t('campaigns.detail.leads_tab')}</h2>
        <Leads initialFilters={campaign.segment || {}} />
      </div>
    </div>
  )
}

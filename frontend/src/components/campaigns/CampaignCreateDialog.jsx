import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { listNumbers } from '../../lib/telephonyApi';
import FilterBuilder from '../filters/FilterBuilder';
import { useToast } from '../ToastProvider';

export default function CampaignCreateDialog({ open, onClose }) {
  const { t } = useTranslation('pages');
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', description: '', segment: { all: [] }, from_number_e164: '' });

  // Fetch numbers for caller ID selection
  const { data: numbers = [] } = useQuery({
    queryKey: ['numbers'],
    queryFn: listNumbers,
    enabled: open
  });

  // Filter numbers that can be used for outbound (hosted or verified)
  const outboundNumbers = numbers.filter(n => n.outbound_enabled && (n.hosted || n.verified_cli));

  const mutation = useMutation({
    mutationFn: async () => {
      // BE /campaigns accetta body JSON con { name, status, segment }
      return (await api.post('/campaigns', { 
        name: form.name, 
        status: 'draft', 
        segment: form.segment,
        description: form.description || null,
        from_number_e164: form.from_number_e164 || null
      })).data;
    },
    onSuccess: (data) => { 
      qc.invalidateQueries(['campaigns']); 
      onClose?.(); 
      toast.success(t('campaigns.create.success'));
      // Redirect to the created campaign
      if (data?.id) {
        window.location.href = `/campaigns/${data.id}`;
      }
    }
  });

  const schema = [
    { id: 'compliance_category', label: t('leads.filters.category') },
    { id: 'contact_class', label: t('leads.filters.class') },
    { id: 'status', label: t('leads.filters.status') },
    { id: 'stage', label: t('leads.filters.stage') },
    { id: 'country_iso', label: t('leads.filters.country') },
    { id: 'created_at', label: t('leads.filters.added') },
    { id: 'updated_at', label: t('leads.filters.updated') },
  ];
  
  const i18nFB = {
    empty: t('leads.filters.empty'),
    select_field: t('leads.filters.select_field'),
    value_placeholder: t('leads.filters.value_placeholder'),
    add: t('leads.filters.add'),
    op: {
      is: t('filters.ops.is'),
      is_not: t('filters.ops.is_not'),
      in: t('filters.ops.in'),
      not_in: t('filters.ops.not_in'),
      before: t('filters.ops.before'),
      after: t('filters.ops.after'),
      between: t('filters.ops.between'),
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">{t('campaigns.create.title')}</h2>
        
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">{t('campaigns.create.name')}</label>
            <input 
              className="w-full rounded-lg border px-3 py-2" 
              value={form.name} 
              onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
              placeholder={t('campaigns.create.name_placeholder')}
            />
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium">{t('campaigns.create.description')}</label>
            <textarea 
              className="w-full rounded-lg border px-3 py-2" 
              rows={3} 
              value={form.description || ''}
              onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
              placeholder={t('campaigns.create.description_placeholder')}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-2">{t('campaigns.create.segment')}</div>
            <FilterBuilder 
              schema={schema} 
              value={form.segment}
              onChange={segment => setForm(s => ({ ...s, segment }))}
              i18n={i18nFB}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">{t('campaigns.create.from_number')}</label>
            <select 
              className="w-full rounded-lg border px-3 py-2" 
              value={form.from_number_e164}
              onChange={e => setForm(s => ({ ...s, from_number_e164: e.target.value }))}
            >
              <option value="">{t('campaigns.create.from_number_placeholder')}</option>
              {outboundNumbers.map(number => (
                <option key={number.id} value={number.phone_e164}>
                  {number.phone_e164} {number.hosted ? '(Hosted)' : '(Verified)'}
                </option>
              ))}
            </select>
            {outboundNumbers.length === 0 && (
              <p className="text-xs text-amber-600">
                {t('campaigns.create.no_outbound_numbers')}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button 
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" 
              onClick={() => mutation.mutate()} 
              disabled={!form.name}
            >
              {t('campaigns.actions.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

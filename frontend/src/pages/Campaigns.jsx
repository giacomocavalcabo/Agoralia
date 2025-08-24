import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '../components/ui/FormField';
import AsyncSelect from '../components/ui/AsyncSelect';
import CallerIdInput from '../components/CallerIdInput';
import { fetchTemplates } from '../lib/hooks/useCampaignTemplates';
import { fetchKB } from '../lib/hooks/useKnowledgeBases';
import { fetchAgents } from '../lib/hooks/useAgents';
import { fetchNumbers } from '../lib/hooks/useNumbers';
import { apiFetch } from '../lib/api';
import { useDemoData } from '../lib/useDemoData';
import { useToast } from '../components/ToastProvider.jsx';

export default function Campaigns() {
  const { t, i18n } = useTranslation('pages');
  const { toast } = useToast();
  const isDemo = useDemoData();
  const [saving, setSaving] = useState(false);
  const [validCaller, setValidCaller] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    goal: 'rfq',
    role: 'supplier',
    language: i18n.language || 'en-US',
    agentId: '',
    callerId: '',
    kbId: '',
    templateId: ''
  });

  const workspaceId = useMemo(() => localStorage.getItem('workspace_id') || '', []);
  const set = (key, value) => setForm(state => ({ ...state, [key]: value }));

  const validate = () => {
    const newErrors = {};
    if (!form.name?.trim()) newErrors.name = t('campaigns.validation.required');
    if (!form.goal) newErrors.goal = t('campaigns.validation.required');
    if (!form.role) newErrors.role = t('campaigns.validation.required');
    if (!form.language) newErrors.language = t('campaigns.validation.required');
    if (!form.kbId) newErrors.kbId = t('campaigns.validation.required');
    if (!form.templateId) newErrors.templateId = t('campaigns.validation.required');
    if (!validCaller && form.callerId) newErrors.callerId = t('campaigns.validation.caller_id');
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    
    try {
      const payload = {
        name: form.name,
        goal: form.goal,
        role: form.role,
        lang_default: form.language,
        agent_id: form.agentId || null,
        from_number: form.callerId,
        kb_id: form.kbId,
        template_id: form.templateId
      };
      
      if (!isDemo) {
        await apiFetch('/campaigns', { method: 'POST', body: payload });
      }
      
      toast(t('campaigns.toasts.created', { id: 'new_campaign' }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Campaign save error:', error);
      }
      toast(t('campaigns.states.error'));
    } finally { 
      setSaving(false); 
    }
  };

  const canProceed = validate() && !saving;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t('campaigns.title')}
          </h1>
          <p className="text-sm text-gray-600">
            {t('campaigns.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md bg-white border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={onSave}
            aria-label={t('campaigns.actions.save')}
            disabled={saving}
          >
            {saving ? t('campaigns.states.loading') : t('campaigns.actions.save')}
          </button>
          <button
            type="button"
            className="rounded-md bg-primary-500 text-white px-3 py-2 text-sm font-medium hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onSave}
            aria-label={t('campaigns.actions.next')}
            disabled={!canProceed}
            title={!canProceed ? t('campaigns.validation.required') : undefined}
          >
            {t('campaigns.actions.next')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField 
          htmlFor="campaign-name" 
          label={t('campaigns.fields.name.label')} 
          error={errors.name}
        >
          <input 
            id="campaign-name" 
            type="text" 
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder={t('campaigns.fields.name.placeholder')}
            value={form.name} 
            onChange={(e) => set('name', e.target.value)}
            aria-describedby={errors.name ? 'campaign-name-err' : undefined} 
          />
        </FormField>

        <FormField 
          htmlFor="campaign-role" 
          label={t('campaigns.fields.role.label')} 
          error={errors.role}
        >
          <select 
            id="campaign-role" 
            className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={form.role} 
            onChange={(e) => set('role', e.target.value)}
            aria-describedby={errors.role ? 'campaign-role-err' : undefined}
          >
            <option value="supplier">{t('campaigns.fields.role.options.supplier')}</option>
            <option value="customer">{t('campaigns.fields.role.options.customer')}</option>
              </select>
        </FormField>

        <FormField 
          htmlFor="campaign-goal" 
          label={t('campaigns.fields.goal.label')} 
          error={errors.goal}
        >
          <select 
            id="campaign-goal" 
            className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={form.goal} 
            onChange={(e) => set('goal', e.target.value)}
            aria-describedby={errors.goal ? 'campaign-goal-err' : undefined}
          >
            <option value="rfq">{t('campaigns.fields.goal.options.rfq')}</option>
            <option value="survey">{t('campaigns.fields.goal.options.survey')}</option>
            <option value="nps">{t('campaigns.fields.goal.options.nps')}</option>
            <option value="custom">{t('campaigns.fields.goal.options.custom')}</option>
              </select>
        </FormField>

        <FormField 
          htmlFor="campaign-language" 
          label={t('campaigns.fields.language.label')} 
          error={errors.language}
        >
          <select 
            id="campaign-language" 
            className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={form.language} 
            onChange={(e) => set('language', e.target.value)}
            aria-describedby={errors.language ? 'campaign-language-err' : undefined}
          >
            <option value="en-US">English (US)</option>
            <option value="it-IT">Italiano</option>
            <option value="fr-FR">Français</option>
            <option value="es-ES">Español</option>
            <option value="de-DE">Deutsch</option>
            </select>
        </FormField>

        <FormField 
          htmlFor="campaign-agent" 
          label={t('campaigns.fields.agent.label')}
        >
          <AsyncSelect
            fetcher={fetchAgents}
            value={form.agentId}
            onChange={(v) => set('agentId', v)}
            placeholder={t('campaigns.fields.agent.placeholder')}
            ariaLabel={t('campaigns.fields.agent.label')}
          />
        </FormField>

        <FormField 
          htmlFor="campaign-caller-id" 
          label={t('campaigns.fields.caller_id.label')} 
          error={errors.callerId}
        >
          <CallerIdInput
            value={form.callerId}
            onChange={(v) => set('callerId', v)}
            onValidChange={setValidCaller}
            placeholder={t('campaigns.fields.caller_id.placeholder')}
            ariaLabel={t('campaigns.fields.caller_id.label')}
          />
        </FormField>

        <FormField 
          htmlFor="campaign-kb" 
          label={t('campaigns.fields.knowledge_base.label')} 
          error={errors.kbId}
        >
          <AsyncSelect
            fetcher={(q, p, signal) => fetchKB(q, p, signal, workspaceId)}
            value={form.kbId}
            onChange={(v) => set('kbId', v)}
            placeholder={t('campaigns.fields.knowledge_base.placeholder')}
            ariaLabel={t('campaigns.fields.knowledge_base.label')}
          />
        </FormField>

        <FormField 
          htmlFor="campaign-template" 
          label={t('campaigns.fields.template.label')} 
          error={errors.templateId}
        >
          <AsyncSelect
            fetcher={fetchTemplates}
            value={form.templateId}
            onChange={(v) => set('templateId', v)}
            placeholder={t('campaigns.fields.template.placeholder')}
            ariaLabel={t('campaigns.fields.template.label')}
          />
        </FormField>
        </div>
    </div>
  );
}



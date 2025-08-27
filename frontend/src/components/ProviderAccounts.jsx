// frontend/src/components/ProviderAccounts.jsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProviders, upsertProvider } from "../lib/numbersApi";
import { useTranslation } from "react-i18next";

export default function ProviderAccounts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: providers = [] } = useQuery({ queryKey: ["providers"], queryFn: listProviders });
  
  const m = useMutation({
    mutationFn: upsertProvider,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] })
  });

  const onSave = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    m.mutate({
      provider: f.get("provider"),
      api_key: f.get("api_key"),
      label: f.get("label") || undefined,
    });
    
    // Reset form
    e.target.reset();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('settings.telephony.providers.title', 'Provider accounts')}</h3>
      
      <ul className="space-y-2">
        {providers.map(p => (
          <li key={p.id} className="p-3 rounded border flex items-center justify-between">
            <div>
              <div className="font-medium">{p.provider.toUpperCase()}</div>
              <div className="text-sm text-muted-foreground">{p.label || p.id}</div>
            </div>
            <span className="text-xs rounded px-2 py-1 bg-emerald-100 text-emerald-700">
              {t('settings.telephony.providers.linked', 'Linked')}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={onSave} className="grid md:grid-cols-4 gap-3 p-3 border rounded">
        <select className="input" name="provider" required defaultValue="telnyx">
          <option value="telnyx">Telnyx</option>
          <option value="twilio">Twilio</option>
        </select>
        <input className="input" name="label" placeholder={t('settings.telephony.providers.label_placeholder', 'Label (opzionale)')} />
        <input className="input" name="api_key" placeholder={t('settings.telephony.providers.api_key_placeholder', 'API Key (non verrà mostrata)')} required />
        <button className="btn btn-primary" disabled={m.isPending}>
          {t('settings.telephony.providers.connect', 'Collega')}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('settings.telephony.providers.description', 'Le API key vengono cifrate a riposo. Potrai acquistare o aggiungere numeri direttamente qui sotto.')}
      </p>
    </div>
  );
}

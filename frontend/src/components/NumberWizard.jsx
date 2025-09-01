// frontend/src/components/NumberWizard.jsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProviders, purchaseNumber, importNumberApi, listOrders, complianceRequirements } from "../lib/telephonyApi";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";

export default function NumberWizard({ budget }) {
  const { t } = useTranslation('settings');
  const qc = useQueryClient();
  const { data: providers = [] } = useQuery({ queryKey: ["providers"], queryFn: listProviders });
  const { data: orders = [] } = useQuery({ 
    queryKey: ["orders"], 
    queryFn: listOrders, 
    refetchInterval: 5000 
  });

  const mBuy = useMutation({
    mutationFn: purchaseNumber,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] })
  });
  
  const mImport = useMutation({
    mutationFn: importNumberApi,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] })
  });

  const onBuy = async (e) => {
    e.preventDefault();
    
    // Check budget hard-stop
    if (budget?.blocked) {
      alert(t('billing.hard_stop_detail'));
      return;
    }
    
    const f = new FormData(e.currentTarget);
    const country = f.get("country");
    const type = f.get("type");
    
    // Check compliance requirements
    try {
      const req = await complianceRequirements({ country, type, entity: 'business' });
      if (req.required && req.status !== 'approved') {
        alert(t('compliance.required_message'));
        return;
      }
    } catch (error) {
      console.error('Compliance check failed:', error);
    }
    
    mBuy.mutate({
      provider_account_id: f.get("provider_account_id"),
      country,
      type,
      area_code: f.get("area_code") || undefined,
      request_id: nanoid(),
    });
    
    // Reset form
    e.target.reset();
  };

  const onImport = async (e) => {
    e.preventDefault();
    
    // Check budget hard-stop
    if (budget?.blocked) {
      alert(t('billing.hard_stop_detail'));
      return;
    }
    
    const f = new FormData(e.currentTarget);
    const e164 = f.get("e164");
    
    // Extract country from E.164 for compliance check
    const country = e164?.startsWith('+1') ? 'US' : 
                   e164?.startsWith('+39') ? 'IT' : 
                   e164?.startsWith('+44') ? 'GB' : 'US';
    
    // Check compliance requirements
    try {
      const req = await complianceRequirements({ country, type: 'local', entity: 'business' });
      if (req.required && req.status !== 'approved') {
        alert(t('compliance.required_message'));
        return;
      }
    } catch (error) {
      console.error('Compliance check failed:', error);
    }
    
    mImport.mutate({
      provider_account_id: f.get("provider_account_id"),
      e164,
      request_id: nanoid(),
    });
    
    // Reset form
    e.target.reset();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="p-4 border rounded space-y-3">
        <h4 className="font-semibold">{t('telephony.wizard.buy.title', 'Compra numero')}</h4>
        <form onSubmit={onBuy} className="grid md:grid-cols-2 gap-3">
          <select name="provider_account_id" className="rounded-lg border px-3 py-2 text-sm" required>
            <option value="">{t('telephony.wizard.select_provider', 'Seleziona account provider…')}</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {t(`telephony.providers.${p.provider.toLowerCase()}`)} — {p.label || p.id}
              </option>
            ))}
          </select>
          <input 
            className="rounded-lg border px-3 py-2 text-sm" 
            name="country" 
            placeholder={t('telephony.wizard.country_placeholder', 'Paese ISO2 (es. US, IT, IN)')} 
            required 
          />
          <select name="type" className="rounded-lg border px-3 py-2 text-sm" defaultValue="local">
            <option value="local">{t('telephony.wizard.type.local', 'Local')}</option>
            <option value="mobile">{t('telephony.wizard.type.mobile', 'Mobile')}</option>
            <option value="tollfree">{t('telephony.wizard.type.tollfree', 'Toll-free')}</option>
          </select>
          <input 
            className="rounded-lg border px-3 py-2 text-sm" 
            name="area_code" 
            placeholder={t('telephony.wizard.area_code_placeholder', 'Area code (opzionale)')} 
          />
          <div className="md:col-span-2">
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={mBuy.isPending}>
              {t('telephony.wizard.buy.cta', 'Acquista')}
            </button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          {t('telephony.wizard.buy.description', 'In alcuni Paesi potrebbero servire documenti/regulatory bundle. Lo stato potrebbe rimanere "review" finché approvato dal provider.')}
        </p>
      </div>

      <div className="p-4 border rounded space-y-3">
        <h4 className="font-semibold">{t('telephony.wizard.import.title', 'Aggiungi numero esistente')}</h4>
        <form onSubmit={onImport} className="grid md:grid-cols-2 gap-3">
          <select name="provider_account_id" className="rounded-lg border px-3 py-2 text-sm" required>
            <option value="">{t('telephony.wizard.select_provider', 'Seleziona account provider…')}</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {t(`telephony.providers.${p.provider.toLowerCase()}`)} — {p.label || p.id}
              </option>
            ))}
          </select>
          <input 
            className="rounded-lg border px-3 py-2 text-sm" 
            name="e164" 
            placeholder={t('telephony.wizard.e164_placeholder', 'Numero in E.164 (es. +12125551234)')} 
            required 
          />
          <div className="md:col-span-2">
            <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={mImport.isPending}>
              {t('telephony.wizard.import.cta', 'Aggiungi')}
            </button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          {t('telephony.wizard.import.description', 'L\'Outbound è consentito solo se il numero risulta **ospitato e verificato** presso il provider collegato.')}
        </p>
      </div>

      <div className="lg:col-span-2 p-4 border rounded">
        <h4 className="font-semibold mb-2">{t('telephony.wizard.orders.title', 'Ordini & Import')}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">{t('telephony.wizard.orders.order_id', 'Order ID')}</th>
                <th>{t('telephony.wizard.orders.provider', 'Provider')}</th>
                <th>{t('telephony.wizard.orders.number', 'Numero')}</th>
                <th>{t('telephony.wizard.orders.status', 'Stato')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">{o.id}</td>
                  <td className="text-center">{o.provider.toUpperCase()}</td>
                  <td className="text-center">{o.e164 || "—"}</td>
                  <td className="text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      o.status === "active" ? "bg-emerald-100 text-emerald-700" :
                      o.status === "failed" ? "bg-rose-100 text-rose-700" :
                      "bg-amber-100 text-amber-800"
                    }`}>{o.status}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    {t('telephony.wizard.orders.empty', 'Nessun ordine')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// frontend/src/components/NumberWizard.jsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listProviders, purchaseNumber, importNumberApi, listOrders } from "../lib/numbersApi";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";

export default function NumberWizard() {
  const { t } = useTranslation();
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

  const onBuy = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mBuy.mutate({
      provider_account_id: f.get("provider_account_id"),
      country: f.get("country"),
      type: f.get("type"),
      area_code: f.get("area_code") || undefined,
      request_id: nanoid(),
    });
    
    // Reset form
    e.target.reset();
  };

  const onImport = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    mImport.mutate({
      provider_account_id: f.get("provider_account_id"),
      e164: f.get("e164"),
      request_id: nanoid(),
    });
    
    // Reset form
    e.target.reset();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="p-4 border rounded space-y-3">
        <h4 className="font-semibold">{t('settings.telephony.wizard.buy.title', 'Compra numero')}</h4>
        <form onSubmit={onBuy} className="grid md:grid-cols-2 gap-3">
          <select name="provider_account_id" className="input" required>
            <option value="">{t('settings.telephony.wizard.select_provider', 'Seleziona account provider…')}</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.provider.toUpperCase()} — {p.label || p.id}
              </option>
            ))}
          </select>
          <input 
            className="input" 
            name="country" 
            placeholder={t('settings.telephony.wizard.country_placeholder', 'Paese ISO2 (es. US, IT, IN)')} 
            required 
          />
          <select name="type" className="input" defaultValue="local">
            <option value="local">{t('settings.telephony.wizard.type.local', 'Local')}</option>
            <option value="mobile">{t('settings.telephony.wizard.type.mobile', 'Mobile')}</option>
            <option value="tollfree">{t('settings.telephony.wizard.type.tollfree', 'Toll-free')}</option>
          </select>
          <input 
            className="input" 
            name="area_code" 
            placeholder={t('settings.telephony.wizard.area_code_placeholder', 'Area code (opzionale)')} 
          />
          <div className="md:col-span-2">
            <button className="btn btn-primary" disabled={mBuy.isPending}>
              {t('settings.telephony.wizard.buy.cta', 'Acquista')}
            </button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          {t('settings.telephony.wizard.buy.description', 'In alcuni Paesi potrebbero servire documenti/regulatory bundle. Lo stato potrebbe rimanere "review" finché approvato dal provider.')}
        </p>
      </div>

      <div className="p-4 border rounded space-y-3">
        <h4 className="font-semibold">{t('settings.telephony.wizard.import.title', 'Aggiungi numero esistente')}</h4>
        <form onSubmit={onImport} className="grid md:grid-cols-2 gap-3">
          <select name="provider_account_id" className="input" required>
            <option value="">{t('settings.telephony.wizard.select_provider', 'Seleziona account provider…')}</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.provider.toUpperCase()} — {p.label || p.id}
              </option>
            ))}
          </select>
          <input 
            className="input" 
            name="e164" 
            placeholder={t('settings.telephony.wizard.e164_placeholder', 'Numero in E.164 (es. +12125551234)')} 
            required 
          />
          <div className="md:col-span-2">
            <button className="btn" disabled={mImport.isPending}>
              {t('settings.telephony.wizard.import.cta', 'Aggiungi')}
            </button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          {t('settings.telephony.wizard.import.description', 'L\'Outbound è consentito solo se il numero risulta **ospitato e verificato** presso il provider collegato.')}
        </p>
      </div>

      <div className="lg:col-span-2 p-4 border rounded">
        <h4 className="font-semibold mb-2">{t('settings.telephony.wizard.orders.title', 'Ordini & Import')}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">{t('settings.telephony.wizard.orders.order_id', 'Order ID')}</th>
                <th>{t('settings.telephony.wizard.orders.provider', 'Provider')}</th>
                <th>{t('settings.telephony.wizard.orders.number', 'Numero')}</th>
                <th>{t('settings.telephony.wizard.orders.status', 'Stato')}</th>
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
                    {t('settings.telephony.wizard.orders.empty', 'Nessun ordine')}
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

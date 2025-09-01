// frontend/src/components/CoveragePanel.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCoverage, searchInventoryTwilio } from "../lib/telephonyApi";
import { CheckIcon, XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

export default function CoveragePanel() {
  const { t } = useTranslation('settings');
  const [selectedProvider, setSelectedProvider] = useState("twilio");
  const [selectedCountry, setSelectedCountry] = useState("");

  // Fetch coverage for selected provider
  const { data: coverageData, isLoading: coverageLoading } = useQuery({
    queryKey: ["coverage", selectedProvider],
    queryFn: () => getCoverage(selectedProvider),
    enabled: !!selectedProvider,
  });

  // Get countries and capabilities from coverage data
  const countries = coverageData?.countries || [];
  const selectedCountryData = countries.find(c => c.alpha2 === selectedCountry);
  const capabilities = selectedCountryData?.types ? {
    buy: selectedCountryData.types,
    features: {
      voice: true,  // Default - in futuro potremmo estenderlo
      sms: true,
      mms: selectedCountryData.types.mobile || false
    },
    import_supported: true,  // Default - in futuro potremmo estenderlo
    regulatory: selectedCountryData.regulatory || [],
    notes: []
  } : null;

  const handleCountrySelect = (countryCode) => {
    setSelectedCountry(countryCode);
  };

  const getStatusIcon = (enabled) => {
    return enabled ? (
      <CheckIcon className="w-5 h-5 text-green-600" />
    ) : (
      <XMarkIcon className="w-5 h-5 text-red-600" />
    );
  };

  const getStatusText = (enabled) => {
    return enabled ? (
      <span className="text-green-700 font-medium">✓ {t('settings.telephony.coverage.status.available')}</span>
    ) : (
      <span className="text-red-700 font-medium">✗ {t('settings.telephony.coverage.status.not_available')}</span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {t('settings.telephony.coverage.title', 'Coverage & Requirements')}
        </h3>
        <div className="flex items-center gap-2">
          <select
            className="input"
            value={selectedProvider}
            onChange={(e) => {
              setSelectedProvider(e.target.value);
              setSelectedCountry("");
            }}
          >
            <option value="twilio">Twilio</option>
            <option value="telnyx">Telnyx</option>
          </select>
        </div>
      </div>

      {/* Provider Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <InformationCircleIcon className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-900">
            {selectedProvider.toUpperCase()} - {t('settings.telephony.coverage.provider_info.global_coverage')}
          </span>
        </div>
        <p className="text-sm text-blue-800">
          {selectedProvider === "twilio" 
            ? t('settings.telephony.coverage.provider_info.twilio_description')
            : t('settings.telephony.coverage.provider_info.telnyx_description')
          }
        </p>
      </div>

      {/* Country Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t('settings.telephony.coverage.select_country', 'Seleziona Paese')}
        </label>
        <select
          className="input w-full"
          value={selectedCountry}
          onChange={(e) => handleCountrySelect(e.target.value)}
        >
          <option value="">{t('settings.telephony.coverage.choose_country', 'Scegli un paese...')}</option>
          {countries.map((country) => (
            <option key={country.alpha2} value={country.alpha2}>
              {country.name} ({country.alpha2})
            </option>
          ))}
        </select>
      </div>

      {/* Capabilities Display */}
      {capabilities && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* What you can buy */}
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900">
              {t('settings.telephony.coverage.what_you_can_buy', 'Cosa puoi comprare qui')}
            </h4>
            <div className="space-y-2">
                          {Object.entries(capabilities.buy).map(([type, enabled]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="capitalize">{type === "toll_free" ? "toll-free" : type}</span>
                {getStatusIcon(enabled)}
              </div>
            ))}
            </div>
          </div>

          {/* Features */}
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900">
              {t('settings.telephony.coverage.features', 'Funzionalità')}
            </h4>
            <div className="space-y-2">
              {Object.entries(capabilities.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="capitalize">{feature}</span>
                  {getStatusIcon(enabled)}
                </div>
              ))}
            </div>
          </div>

          {/* Import Support */}
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900">
              {t('settings.telephony.coverage.import_support', 'Import/Porting')}
            </h4>
            <div className="flex items-center justify-between">
              <span>Supportato</span>
              {getStatusIcon(capabilities.import_supported)}
            </div>
          </div>

          {/* Outbound CLI Policy */}
          <div className="p-4 border rounded-lg">
            <h4 className="font-semibold mb-3 text-gray-900">
              {t('settings.telephony.coverage.outbound_policy', 'Outbound Caller ID')}
            </h4>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <strong>Policy Agoralia:</strong> Solo numeri hosted (niente caller ID esterni non verificati)
            </div>
          </div>
        </div>
      )}

      {/* Regulatory Requirements */}
      {capabilities && capabilities.regulatory && Object.keys(capabilities.regulatory).length > 0 && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-900">
            {t('settings.telephony.coverage.requirements', 'Requisiti & Documenti')}
          </h4>
          <div className="space-y-3">
            {Object.entries(capabilities.regulatory).map(([numberType, entities]) => (
              <div key={numberType} className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-sm mb-1 capitalize">
                  {numberType === "toll_free" ? "toll-free" : numberType}
                </div>
                {Object.entries(entities).map(([entityType, fields]) => (
                  <div key={entityType} className="mt-2">
                    <div className="text-xs font-medium text-gray-600 capitalize mb-1">
                      {entityType}
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {fields.map((field, fieldIndex) => (
                        <li key={fieldIndex}>{field}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {capabilities && capabilities.notes && capabilities.notes.length > 0 && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-900">
            {t('settings.telephony.coverage.notes', 'Note')}
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            {capabilities.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Coverage Info */}
      {coverageData && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <InformationCircleIcon className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">
              Informazioni sulla Copertura
            </span>
          </div>
          <p className="text-sm text-blue-800">
            Questa è una fotografia delle capacità (aggiornata: {new Date(coverageData.last_updated * 1000).toLocaleDateString()}). 
            Disponibilità e prezzi sono verificati in tempo reale al momento dell'acquisto.
          </p>
          <p className="text-sm text-blue-800 mt-2">
            La portabilità (mantenere il tuo numero) si verifica caso per caso al momento della richiesta.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {capabilities && (
        <div className="flex gap-3 pt-4">
          <button
            className="btn btn-primary"
            onClick={() => {
              // TODO: Open NumberWizard pre-filled with provider+country
              console.log("Open NumberWizard for", selectedProvider, selectedCountry);
            }}
          >
            {t('settings.telephony.coverage.buy_with_provider', 'Compra con questo provider')}
          </button>
          <button
            className="btn"
            onClick={() => {
              // TODO: Open BYO form with provider selected
              console.log("Open BYO for", selectedProvider);
            }}
          >
            {t('settings.telephony.coverage.add_existing', 'Aggiungi numero esistente')}
          </button>
        </div>
      )}
    </div>
  );
}

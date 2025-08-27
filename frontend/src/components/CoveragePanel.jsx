// frontend/src/components/CoveragePanel.jsx
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchCountries, fetchCapabilities, fetchTwilioPricing } from "../lib/coverageApi";
import { CheckIcon, XMarkIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

export default function CoveragePanel() {
  const { t } = useTranslation('settings');
  const [selectedProvider, setSelectedProvider] = useState("twilio");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [originCountry, setOriginCountry] = useState("US");

  // Fetch countries for selected provider
  const { data: countriesData, isLoading: countriesLoading } = useQuery({
    queryKey: ["countries", selectedProvider],
    queryFn: () => fetchCountries(selectedProvider),
    enabled: !!selectedProvider,
  });

  // Fetch capabilities for selected country
  const { data: capabilitiesData, isLoading: capabilitiesLoading } = useQuery({
    queryKey: ["capabilities", selectedProvider, selectedCountry],
    queryFn: () => fetchCapabilities(selectedProvider, selectedCountry),
    enabled: !!selectedCountry,
  });

  // Fetch Twilio pricing if applicable
  const { data: pricingData } = useQuery({
    queryKey: ["pricing", originCountry, selectedCountry],
    queryFn: () => fetchTwilioPricing(originCountry, selectedCountry),
    enabled: selectedProvider === "twilio" && !!selectedCountry && originCountry !== selectedCountry,
  });

  const countries = countriesData?.countries || [];
  const capabilities = capabilitiesData?.capabilities;

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
      <span className="text-green-700 font-medium">✓ Disponibile</span>
    ) : (
      <span className="text-red-700 font-medium">✗ Non disponibile</span>
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
            {selectedProvider.toUpperCase()} - Copertura Globale
          </span>
        </div>
        <p className="text-sm text-blue-800">
          {selectedProvider === "twilio" 
            ? "Copertura ampia con numeri locali, mobile e toll-free in molti paesi"
            : "Qualità e affidabilità Tier-1, ottimo in Europa/LatAm/APAC"
          }
        </p>
      </div>

      {/* Country Selection */}
      <div className="grid md:grid-cols-2 gap-4">
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
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
        </div>

        {selectedProvider === "twilio" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('settings.telephony.coverage.origin_country', 'Paese di Origine (per pricing)')}
            </label>
            <select
              className="input w-full"
              value={originCountry}
              onChange={(e) => setOriginCountry(e.target.value)}
            >
              <option value="US">United States (US)</option>
              <option value="IT">Italy (IT)</option>
              <option value="DE">Germany (DE)</option>
              <option value="GB">United Kingdom (GB)</option>
            </select>
          </div>
        )}
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
                  <span className="capitalize">{type}</span>
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
      {capabilities && capabilities.regulatory && capabilities.regulatory.length > 0 && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-900">
            {t('settings.telephony.coverage.requirements', 'Requisiti & Documenti')}
          </h4>
          <div className="space-y-3">
            {capabilities.regulatory.map((req, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded">
                <div className="font-medium text-sm mb-1">
                  {req.number_type} - {req.entity}
                </div>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {req.fields.map((field, fieldIndex) => (
                    <li key={fieldIndex}>{field}</li>
                  ))}
                </ul>
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

      {/* Twilio Pricing */}
      {selectedProvider === "twilio" && pricingData && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-3 text-gray-900">
            {t('settings.telephony.coverage.pricing', 'Pricing (stima)')}
          </h4>
          {pricingData.pricing.available ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="text-sm text-green-800">
                <strong>Tariffa:</strong> {pricingData.pricing.rate_per_minute} {pricingData.pricing.currency}/min
              </div>
              <div className="text-xs text-green-700 mt-1">
                {originCountry} → {selectedCountry}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
              Pricing non disponibile per questa rotta
            </div>
          )}
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

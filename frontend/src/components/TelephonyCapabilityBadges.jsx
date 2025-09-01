// frontend/src/components/TelephonyCapabilityBadges.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function TelephonyCapabilityBadges({ number, className = "" }) {
  const { t } = useTranslation('settings.telephony');
  
  if (!number) return null;
  
  const capabilities = [];
  
  // Badge per tipo di numero
  if (number.hosted) {
    capabilities.push({
      type: 'hosted',
      label: t('telephony.badges.hosted'),
      color: 'bg-emerald-100 text-emerald-800',
      tooltip: t('telephony.badges.hosted_tooltip')
    });
  }
  
  // Badge per inbound/outbound
  if (number.inbound_enabled) {
    capabilities.push({
      type: 'inbound',
      label: t('telephony.badges.inbound'),
      color: 'bg-blue-100 text-blue-800',
      tooltip: t('telephony.badges.inbound_tooltip')
    });
  }
  
  if (number.outbound_enabled) {
    capabilities.push({
      type: 'outbound',
      label: t('telephony.badges.outbound'),
      color: 'bg-purple-100 text-purple-800',
      tooltip: t('telephony.badges.outbound_tooltip')
    });
  }
  
  // Badge per SMS/MMS se disponibili
  if (number.capabilities?.sms) {
    capabilities.push({
      type: 'sms',
      label: 'SMS',
      color: 'bg-orange-100 text-orange-800',
      tooltip: t('telephony.badges.sms_tooltip')
    });
  }
  
  if (number.capabilities?.mms) {
    capabilities.push({
      type: 'mms',
      label: 'MMS',
      color: 'bg-pink-100 text-pink-800',
      tooltip: t('telephony.badges.mms_tooltip')
    });
  }
  
  // Badge per portabilità se disponibile
  if (number.portability_status === 'eligible') {
    capabilities.push({
      type: 'portable',
      label: t('telephony.badges.portable'),
      color: 'bg-indigo-100 text-indigo-800',
      tooltip: t('telephony.badges.portable_tooltip')
    });
  }
  
  if (capabilities.length === 0) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        {t('telephony.badges.no_capabilities')}
      </div>
    );
  }
  
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {capabilities.map((cap, index) => (
        <div key={index} className="group relative">
          <span 
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${cap.color} cursor-help`}
          >
            {cap.label}
          </span>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
            {cap.tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

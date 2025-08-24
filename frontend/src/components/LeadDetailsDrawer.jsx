import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateSafe } from '../lib/format'

export default function LeadDetailsDrawer({ open, onOpenChange, lead }) {
  const { t, i18n } = useTranslation('pages')
  
  if (!open) return null
  if (!lead) return null
  
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex">
      <div className="bg-black/30 flex-1" onClick={() => onOpenChange(false)} />
      <div className="w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{t('leads.details.title')}</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.name')}</label>
              <p className="text-sm">{lead.name ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.email')}</label>
              <p className="text-sm">{lead.email ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.phone')}</label>
              <p className="text-sm">{lead.phone ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.status')}</label>
              <p className="text-sm">{lead.status ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.campaign')}</label>
              <p className="text-sm">{lead.campaign ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.stage')}</label>
              <p className="text-sm">{lead.stage ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.owner')}</label>
              <p className="text-sm">{lead.owner ?? '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.score')}</label>
              <p className="text-sm">{lead.score ?? '—'}</p>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-500">{t('leads.table.columns.last_contact')}</label>
            <p className="text-sm">{formatDateSafe(lead.last_contact, i18n.language)}</p>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end gap-2">
          <button 
            className="px-3 py-2 border rounded hover:bg-gray-50" 
            onClick={() => onOpenChange(false)}
          >
            {t('common.close') ?? 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}

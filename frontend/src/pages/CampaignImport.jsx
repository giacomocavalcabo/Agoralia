import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTranslation } from 'react-i18next'

export default function CampaignImport(){
  const { t } = useTranslation('pages')
  const nav = useNavigate()
  const [file, setFile] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  
  async function handleImport(){
    if(!file) return
    
    setIsImporting(true)
    try {
      const text = await file.text()
      const obj = JSON.parse(text)
      const { data } = await api.post('/campaigns', obj)
      nav(`/campaigns/${data?.id || ''}`)
    } catch (error) {
      console.error('Import failed:', error)
      // TODO: Add proper error handling
    } finally {
      setIsImporting(false)
    }
  }
  
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t('campaigns.import.title')}</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('campaigns.import.file_label')}
          </label>
          <input 
            type="file" 
            accept="application/json" 
            onChange={e=>setFile(e.target.files?.[0])}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        
        <div className="rounded-lg border p-3 bg-gray-50">
          <h4 className="text-sm font-medium mb-2">{t('campaigns.import.format_title')}</h4>
          <pre className="text-xs text-gray-600">
{`{
  "name": "Q4 Campaign",
  "status": "draft",
  "segment": {
    "country_iso": ["IT"],
    "status": ["new"]
  }
}`}
          </pre>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <button 
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" 
            onClick={()=>nav(-1)}
          >
            {t('common.cancel')}
          </button>
          <button 
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50" 
            onClick={handleImport} 
            disabled={!file || isImporting}
          >
            {isImporting ? t('common.importing') : t('campaigns.actions.import')}
          </button>
        </div>
      </div>
    </div>
  )
}

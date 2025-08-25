import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'

export default function CampaignForm() {
  const { t } = useTranslation('pages')
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [status, setStatus] = useState('draft')
  const [segment, setSegment] = useState({})

  async function onSubmit(e){
    e.preventDefault()
    try {
      const { data } = await api.post('/campaigns', { name, status, segment })
      nav(`/campaigns/${data?.id || ''}`)
    } catch (error) {
      console.error('Failed to create campaign:', error)
      // TODO: Add proper error handling
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">{t('campaigns.create.title')}</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm font-medium">{t('campaigns.fields.name')}</span>
          <input 
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" 
            value={name} 
            onChange={e=>setName(e.target.value)} 
            required 
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('campaigns.fields.status')}</span>
          <select 
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" 
            value={status} 
            onChange={e=>setStatus(e.target.value)}
          >
            <option value="draft">{t('campaigns.status.draft')}</option>
            <option value="active">{t('campaigns.status.active')}</option>
            <option value="paused">{t('campaigns.status.paused')}</option>
          </select>
        </label>
        <details className="rounded border p-3">
          <summary className="cursor-pointer text-sm font-medium">{t('campaigns.fields.segment')}</summary>
          <textarea 
            className="mt-2 w-full rounded border p-2 font-mono text-xs"
            rows={6}
            value={JSON.stringify(segment, null, 2)}
            onChange={e=>{ try { setSegment(JSON.parse(e.target.value||'{}')) } catch {} }}
            placeholder='{"status":["new"],"country_iso":["IT"]}'
          />
        </details>
        <div className="flex justify-end gap-2 pt-4">
          <button 
            type="button" 
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" 
            onClick={()=>nav(-1)}
          >
            {t('common.cancel')}
          </button>
          <button 
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" 
            type="submit"
          >
            {t('common.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

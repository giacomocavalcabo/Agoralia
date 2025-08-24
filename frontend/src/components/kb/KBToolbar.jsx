import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

// Hook debounce leggero
function useDebounced(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function KBToolbar({ 
  searchValue, 
  onSearchChange, 
  filters, 
  onFiltersChange, 
  bulkActions,
  initial 
}) {
  const { t } = useTranslation('pages')
  const [searchParams, setSearchParams] = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') ?? initial?.q ?? searchValue ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? initial?.status ?? filters?.status ?? '')
  const dq = useDebounced(q, 400)

  // Propaga su URL (deep link)
  useEffect(() => {
    const p = new URLSearchParams(searchParams)
    if (q) p.set('q', q); else p.delete('q')
    if (status) p.set('status', status); else p.delete('status')
    setSearchParams(p, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status])

  // Propaga debounced search
  useEffect(() => {
    onSearchChange?.({ q: dq, status })
  }, [dq, status, onSearchChange])

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-4 flex-1">
        <Input
          placeholder={t('kb.overview.toolbar.search_placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-80"
          data-testid="kb-search"
            />
        
        <Select
          value={status}
          onValueChange={(value) => setStatus(value)}
        >
          <option value="">{t('kb.overview.toolbar.filter.all')}</option>
          <option value="published">{t('kb.overview.toolbar.filter.published')}</option>
          <option value="drafts">{t('kb.overview.toolbar.filter.drafts')}</option>
          <option value="archived">{t('kb.overview.toolbar.filter.archived')}</option>
        </Select>
      </div>
      
      {bulkActions && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="bulk-assign">
            {t('kb.overview.toolbar.bulk.assign')}
          </Button>
          <Button variant="outline" size="sm" data-testid="bulk-delete">
            {t('kb.overview.toolbar.bulk.delete')}
          </Button>
          <Button variant="outline" size="sm" data-testid="bulk-export">
            {t('kb.overview.toolbar.bulk.export')}
          </Button>
        </div>
      )}
    </div>
  )
}

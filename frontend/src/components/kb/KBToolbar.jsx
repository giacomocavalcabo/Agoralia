import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'

export default function KBToolbar({ 
  searchValue, 
  onSearchChange, 
  filters, 
  onFiltersChange, 
  bulkActions 
}) {
  const { t } = useTranslation('pages')
  
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center gap-4 flex-1">
        <Input
          placeholder={t('kb.overview.toolbar.search_placeholder')}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-80"
          data-testid="kb-search"
        />
        
        <Select
          value={filters?.status || ''}
          onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
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

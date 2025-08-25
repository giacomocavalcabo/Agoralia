import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import { useReleaseNumber } from '../../lib/useNumbers'

export default function NumbersRowActions({ row, onAssign, onConfigure, onDetails }) {
  const { t } = useTranslation('pages')
  const { mutateAsync: release, isLoading } = useReleaseNumber()
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false)

  const handleRelease = async () => {
    try {
      await release(row.id)
      setReleaseDialogOpen(false)
      // Toast success will be handled by the mutation
    } catch (error) {
      // Error will be handled by the mutation
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid={`row-actions-${row.id}`}>
      <Button size="sm" variant="ghost" onClick={() => onDetails(row)}>
        {t('numbers.actions.view')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onConfigure(row)}>
        {t('numbers.actions.configure')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onAssign(row)}>
        {t('numbers.actions.assign')}
      </Button>
      <Button 
        size="sm" 
        variant="ghost" 
        onClick={() => setReleaseDialogOpen(true)}
        disabled={isLoading}
      >
        {t('numbers.actions.release')}
      </Button>

      <ConfirmDialog
        open={releaseDialogOpen}
        onClose={() => setReleaseDialogOpen(false)}
        title={t('numbers.dialogs.release.title')}
        confirmLabel={t('numbers.dialogs.release.confirm')}
        cancelLabel={t('numbers.dialogs.release.cancel')}
        onConfirm={handleRelease}
        confirmVariant="destructive"
      >
        <p className="text-sm text-gray-600">{t('numbers.dialogs.release.body')}</p>
      </ConfirmDialog>
    </div>
  )
}

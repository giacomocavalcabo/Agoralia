import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button.jsx'

export default function NumbersRowActions({ row, onAssign, onRelease, onConfigure, onDetails }) {
  const { t } = useTranslation('pages')
  return (
    <div className="flex items-center gap-2" data-testid={`row-actions-${row.id}`}>
      <Button size="sm" variant="ghost" onClick={() => onAssign(row)}>{t('numbers.actions.assign')}</Button>
      <Button size="sm" variant="ghost" onClick={() => onRelease(row)}>{t('numbers.actions.release')}</Button>
      <Button size="sm" variant="ghost" onClick={() => onConfigure(row)}>{t('numbers.actions.configure')}</Button>
      <Button size="sm" variant="ghost" onClick={() => onDetails(row)}>{t('numbers.actions.details')}</Button>
    </div>
  )
}

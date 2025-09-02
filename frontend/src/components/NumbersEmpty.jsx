import { useTranslation } from 'react-i18next'

export default function NumbersEmpty({ onAdd, onBuy }) {
  const { t } = useTranslation('settings')
  
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <div className="text-lg font-medium">{t('telephony.numbers_empty.title')}</div>
      <p className="mt-1 text-sm text-gray-600">
        {t('telephony.numbers_empty.description')}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button className="btn btn-primary" onClick={onAdd}>
          {t('telephony.numbers_empty.add_existing')}
        </button>
        <button className="btn btn-outline" onClick={onBuy}>
          {t('telephony.numbers_empty.buy_number')}
        </button>
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PaymentsDisabledBanner } from '../providers/StripeProvider.jsx'
import { useDemoData } from '../lib/useDemoData'
import { 
  CreditCardIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

// Mock data - in production this would come from API
const mockBillingData = {
  balance: 100000000.00, // Admin gets 100M€! 🚀
  usage: {
    mtd: 1250.75, // Usage molto basso rispetto al saldo
    cap: 1000000000.00, // Cap a 1 miliardo
    minutes: 5000,
    minutesCap: 1000000 // 1M di minuti
  },
  autoRecharge: {
    enabled: true,
    threshold: 1000000.00, // Ricarica automatica a 1M€
    topup: 10000000.00 // Ricarica di 10M€
  },
  usageCap: {
    type: 'soft', // 'hard' or 'soft'
    limit: 1000000000.00, // Limite a 1 miliardo
    warning: 800000000.00 // Warning a 800M€
  },
  paymentMethods: [
    {
      id: 'pm_1',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      expMonth: 12,
      expYear: 2025,
      isDefault: true
    },
    {
      id: 'pm_2',
      type: 'card',
      last4: '8888',
      brand: 'mastercard',
      expMonth: 6,
      expYear: 2026,
      isDefault: false
    }
  ],
  invoices: [
    {
      id: 'inv_1',
      number: 'INV-2025-001',
      period: 'January 2025',
      amount: 1250.75,
      status: 'paid',
      date: '2025-01-15'
    },
    {
      id: 'inv_2',
      number: 'INV-2024-012',
      period: 'December 2024',
      amount: 890.50,
      status: 'paid',
      date: '2024-12-15'
    }
  ]
}

function OverviewCards({ data }) {
  const { t } = useTranslation('settings')
  
  // Safety checks
  if (!data) return null
  
  // ✅ fallback sobrio: zeri, no "unlimited"
  const safeData = {
    monthly_budget_cents: data?.monthly_budget_cents ?? 0,
    budget_currency: data?.budget_currency ?? "USD",
    budget_hard_stop: data?.budget_hard_stop ?? true,
    mtd_spend_cents: data?.mtd_spend_cents ?? 0,
    minutes_mtd: data?.minutes_mtd ?? 0,
    cap_percent: (() => {
      const cap = data?.monthly_budget_cents ?? 0;
      const mtd = data?.mtd_spend_cents ?? 0;
      return cap > 0 ? Math.min(100, Math.round((mtd / cap) * 100)) : 0;
    })(),
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Balance */}
      <div className="border rounded-xl p-4">
        <div className="text-xs uppercase text-slate-500">
          {t("settings.billing.overview.balance","Balance")}
        </div>
        <div className="text-xl font-semibold">
          {new Intl.NumberFormat(undefined,{style:"currency",currency:safeData.budget_currency}).format((safeData.monthly_budget_cents - safeData.mtd_spend_cents)/100)}
        </div>
      </div>
      
      {/* Usage MTD */}
      <div className="border rounded-xl p-4">
        <div className="text-xs uppercase text-slate-500">
          {t("settings.billing.overview.usage_mtd","Usage (MTD)")}
        </div>
        <div className="text-xl font-semibold">
          {new Intl.NumberFormat(undefined,{style:"currency",currency:safeData.budget_currency}).format(safeData.mtd_spend_cents/100)}
        </div>
        <div className="text-xs text-slate-500">
          {t("settings.billing.overview.of_cap","of {{cap}}",{
            cap: new Intl.NumberFormat(undefined,{style:"currency",currency:safeData.budget_currency}).format((safeData.monthly_budget_cents||0)/100)
          })}
        </div>
      </div>
      
      {/* Minutes MTD */}
      <div className="border rounded-xl p-4">
        <div className="text-xs uppercase text-slate-500">
          {t("settings.billing.overview.minutes_mtd","Minutes (MTD)")}
        </div>
        <div className="text-xl font-semibold">
          {new Intl.NumberFormat().format(safeData.minutes_mtd || 0)}
        </div>
        <div className="text-xs text-slate-500">
          {t("settings.billing.overview.cap_status_label","Cap status")}: {safeData.cap_percent}%
        </div>
      </div>
    </div>
  )
}

function PaymentMethods({ data = [], onAddCard }) {
  const { t } = useTranslation('billing')
  
  // Fallback difensivo
  if (!Array.isArray(data)) data = [];
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('payment_methods.title') || 'Payment Methods'}
        </h3>
        <button
          onClick={onAddCard}
          disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
          className={`inline-flex items-center px-4 py-2 font-medium rounded-lg transition-colors ${
            import.meta.env.VITE_DEMO_MODE === 'true'
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
          title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('payment_methods.add') || 'Add Card'}
        </button>
      </div>
      
      <div className="space-y-4">
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCardIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Nessun metodo di pagamento</p>
            <p className="text-sm">Aggiungi una carta per abilitare i pagamenti</p>
          </div>
        ) : (
          data.map((method) => (
          <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center">
              <CreditCardIcon className="h-6 w-6 text-gray-400 mr-3" />
              <div>
                <p className="font-medium text-gray-900">
                  {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                </p>
                <p className="text-sm text-gray-500">
                  Expires {method.expMonth}/{method.expYear}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {method.isDefault && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {t('payment_methods.default') || 'Default'}
                </span>
              )}
              <button 
                className={`text-sm ${
                  import.meta.env.VITE_DEMO_MODE === 'true'
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
                title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
              >
                {t('common.edit') || 'Edit'}
              </button>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  )
}

function AutoRecharge({ data, onUpdate }) {
  const { t } = useTranslation('billing')
  const [formData, setFormData] = useState(data)
  const [isEditing, setIsEditing] = useState(false)
  
  const handleSave = () => {
    onUpdate(formData)
    setIsEditing(false)
  }
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('auto_recharge.title') || 'Auto-Recharge'}
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
          className={`text-sm font-medium ${
            import.meta.env.VITE_DEMO_MODE === 'true'
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-green-600 hover:text-green-800'
          }`}
          title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
        >
          {isEditing ? t('common.cancel') : t('common.edit')}
        </button>
      </div>
      
      {isEditing ? (
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoRechargeEnabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`h-4 w-4 focus:ring-green-500 border-gray-300 rounded ${
                import.meta.env.VITE_DEMO_MODE === 'true'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600'
              }`}
            />
            <label htmlFor="autoRechargeEnabled" className="ml-2 text-sm text-gray-700">
              {t('auto_recharge.enable') || 'Enable  auto-recharge'} 
            </label>
          </div>
          
          {formData.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auto_recharge.threshold') || 'Recharge when balance falls below'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({...formData, threshold: parseFloat(e.target.value)})}
                    disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
                    className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      import.meta.env.VITE_DEMO_MODE === 'true' ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auto_recharge.topup') || 'Recharge amount'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.topup}
                    onChange={(e) => setFormData({...formData, topup: parseFloat(e.target.value)})}
                    disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
                    className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      import.meta.env.VITE_DEMO_MODE === 'true' ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsEditing(false)}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`px-4 py-2 ${
                import.meta.env.VITE_DEMO_MODE === 'true'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`px-6 py-2 font-medium rounded-lg ${
                import.meta.env.VITE_DEMO_MODE === 'true'
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
            >
              {t('common.save') || 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {data.enabled ? t('auto_recharge.enabled') : t('auto_recharge.disabled')}
              </p>
              {data.enabled && (
                <p className="text-sm text-gray-500">
                  {t('auto_recharge.description', {
                    topup: data.topup,
                    threshold: data.threshold
                  }) || `Recharge $${data.topup} when balance falls below $${data.threshold}`}
                </p>
              )}
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data.enabled 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {data.enabled ? t('common.on') : t('common.off')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function UsageCap({ data, onUpdate }) {
  const { t } = useTranslation('billing')
  const [formData, setFormData] = useState(data)
  const [isEditing, setIsEditing] = useState(false)
  
  const handleSave = () => {
    onUpdate(formData)
    setIsEditing(false)
  }
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('usage_cap.title') || 'Usage Cap'}
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
          className={`text-sm font-medium ${
            import.meta.env.VITE_DEMO_MODE === 'true'
              ? 'text-gray-400 cursor-not-allowed'
              : 'text-green-600 hover:text-green-800'
          }`}
          title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
        >
          {isEditing ? t('common.cancel') : t('common.edit')}
        </button>
      </div>
      
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('usage_cap.type') || 'Cap Type'}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                import.meta.env.VITE_DEMO_MODE === 'true' ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
                              <option value="soft">{t('usage_cap.soft') || 'Soft Cap (warnings only)'}</option>
                <option value="hard">{t('usage_cap.hard') || 'Hard Cap (stop calls)'}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('usage_cap.limit') || 'Monthly Limit ($)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.limit}
                onChange={(e) => setFormData({...formData, limit: parseFloat(e.target.value)})}
                disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
                className={`w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                  import.meta.env.VITE_DEMO_MODE === 'true' ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsEditing(false)}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`px-4 py-2 ${
                import.meta.env.VITE_DEMO_MODE === 'true'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
              className={`px-6 py-2 font-medium rounded-lg ${
                import.meta.env.VITE_DEMO_MODE === 'true'
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
            >
              {t('common.save') || 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {data.type === 'hard' ? t('usage_cap.hard_cap') : t('usage_cap.soft_cap')}
              </p>
              <p className="text-sm text-gray-500">
                {t('usage_cap.description', {
                  limit: data.limit,
                  type: data.type === 'hard' ? t('usage_cap.stop_calls') : t('usage_cap.warnings_only')
                }) || `Limit: $${data.limit} - ${data.type === 'hard' ? 'Stop calls at limit' : 'Warnings only'}`}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data.type === 'hard' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {data.type === 'hard' ? t('usage_cap.hard') : t('usage_cap.soft')}
            </span>
          </div>
          
          {/* Usage Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
                              <span>{t('usage_cap.current') || 'Current Usage'}</span>  
              <span>${mockBillingData.usage.mtd.toFixed(2)} / ${data.limit.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  mockBillingData.usage.mtd / data.limit > 0.8 
                    ? 'bg-red-500' 
                    : mockBillingData.usage.mtd / data.limit > 0.6 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((mockBillingData.usage.mtd / data.limit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Invoices({ data }) {
  const { t } = useTranslation('billing')
  
  // Safety checks
  if (!data || !Array.isArray(data.invoices)) return null
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  {t('invoices.title') || 'Recent Invoices'}
      </h3>
      
      <div className="space-y-4">
        {data.invoices.map((invoice) => (
          <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{invoice.number}</p>
              <p className="text-sm text-gray-500">{invoice.period}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-lg font-semibold text-gray-900">
                ${invoice.amount.toFixed(2)}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                invoice.status === 'paid' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {invoice.status}
              </span>
              <button className="text-sm text-green-600 hover:text-green-800">
                {t('invoices.download') || 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <button className="text-sm text-green-600 hover:text-green-800 font-medium">
                      {t('invoices.view_all') || 'View All Invoices'}
        </button>
      </div>
    </div>
  )
}

function BudgetAndLimits() {
  const { t } = useTranslation('settings')
  const [budget, setBudget] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({})
  const [error, setError] = useState(null)
  
  useEffect(() => {
    loadBudget()
  }, [])
  
  const loadBudget = async () => {
    try {
      setIsLoading(true)
      const { getBudget } = await import('../lib/billingApi.js')
      const budgetData = await getBudget()
      setBudget(budgetData)
      setFormData({
        monthly_budget_cents: budgetData.settings.monthly_budget_cents,
        budget_currency: budgetData.settings.budget_currency,
        budget_resets_day: budgetData.settings.budget_resets_day,
        budget_hard_stop: budgetData.settings.budget_hard_stop,
        budget_thresholds: budgetData.settings.budget_thresholds
      })
    } catch (err) {
      console.error('Failed to load budget:', err)
      setError('Failed to load budget settings')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleSave = async () => {
    try {
      setIsLoading(true)
      const { updateBudget } = await import('../lib/billingApi.js')
      const updatedBudget = await updateBudget(formData)
      setBudget(updatedBudget)
      setIsEditing(false)
      // Show success message
      if (window.toast) {
        window.toast.success(t('budget.saved') || 'Budget settings saved')
      }
    } catch (err) {
      console.error('Failed to update budget:', err)
      setError('Failed to save budget settings')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleCancel = () => {
    setFormData({
      monthly_budget_cents: budget?.settings.monthly_budget_cents || 0,
      budget_currency: budget?.settings.budget_currency || 'USD',
      budget_resets_day: budget?.settings.budget_resets_day || 1,
      budget_hard_stop: budget?.settings.budget_hard_stop || true,
      budget_thresholds: budget?.settings.budget_thresholds || [0.8, 1.0]
    })
    setIsEditing(false)
    setError(null)
  }
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Budget</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadBudget}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  
  const monthlyBudget = budget?.settings.monthly_budget_cents || 0
  const mtdSpend = budget?.spend_month_to_date_cents || 0
  const progressPercentage = monthlyBudget > 0 ? Math.min(100, (mtdSpend / monthlyBudget) * 100) : 0
  const isBlocked = budget?.blocked || false
  const thresholdHit = budget?.threshold_hit
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('budget.title') || 'Budget & Limits'}
          </h3>
          <p className="text-sm text-gray-600">
            Manage your monthly spending limits and budget controls
          </p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={isLoading}
        >
          {isEditing ? t('common.cancel') || 'Cancel' : t('common.edit') || 'Edit'}
        </button>
      </div>
      
      {/* Budget Progress Bar */}
      {monthlyBudget > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {t('budget.progress') || 'Month-to-date spend'}
            </span>
            <span className="text-sm text-gray-600">
              ${(mtdSpend / 100).toFixed(2)} / ${(monthlyBudget / 100).toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                progressPercentage >= 100 ? 'bg-red-500' :
                progressPercentage >= 80 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          {thresholdHit && (
            <div className={`mt-2 text-sm ${
              thresholdHit >= 1.0 ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {thresholdHit >= 1.0 
                ? t('budget.blocked') || 'Monthly budget reached. Purchase/Import are disabled.'
                : t('budget.warn80') || 'You have reached 80% of your monthly budget.'
              }
            </div>
          )}
        </div>
      )}
      
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('budget.monthly') || 'Monthly budget (USD)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.monthly_budget_cents / 100}
              onChange={(e) => setFormData({
                ...formData, 
                monthly_budget_cents: Math.round(parseFloat(e.target.value || 0) * 100)
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('budget.resets') || 'Resets on day'}
            </label>
            <select
              value={formData.budget_resets_day}
              onChange={(e) => setFormData({...formData, budget_resets_day: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({length: 28}, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="hardStop"
              checked={formData.budget_hard_stop}
              onChange={(e) => setFormData({...formData, budget_hard_stop: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="hardStop" className="ml-2 text-sm text-gray-700">
              {t('budget.hard_stop') || 'Stop operations when limit is reached'}
            </label>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Monthly Budget:</span>
            <span className="text-sm font-medium text-gray-900">
              ${(monthlyBudget / 100).toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Currency:</span>
            <span className="text-sm font-medium text-gray-900">
              {budget?.settings.budget_currency || 'USD'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Resets on day:</span>
            <span className="text-sm font-medium text-gray-900">
              {budget?.settings.budget_resets_day || 1}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Hard stop:</span>
            <span className="text-sm font-medium text-gray-900">
              {budget?.settings.budget_hard_stop ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          
          {isBlocked && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm text-red-700">
                  {t('budget.blocked') || 'Operations are currently blocked due to budget limit'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Main Billing component
export default function Billing() {
  const { t } = useTranslation('billing')
  const isDemo = useDemoData()
  const [billingData, setBillingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // DEMO mode guard
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || isDemo
  
  useEffect(() => {
    // Simula caricamento dati da API
    const loadBillingData = async () => {
      try {
        setLoading(true)
        // In produzione, qui faremmo una chiamata API
        // const response = await apiFetch('/billing')
        // setBillingData(response)
        
        // Per ora usiamo i mock data con un delay per simulare il caricamento
        setTimeout(() => {
          setBillingData(mockBillingData)
          setLoading(false)
        }, 500)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    
    loadBillingData()
  }, [])
  
  const handleAutoRechargeUpdate = (newData) => {
    if (isDemoMode) {
      alert('Demo mode: Auto-recharge updates disabled')
      return
    }
    if (billingData) {
      setBillingData({...billingData, autoRecharge: newData})
    }
  }
  
  const handleUsageCapUpdate = (newData) => {
    if (isDemoMode) {
      alert('Demo mode: Usage cap updates disabled')
      return
    }
    if (billingData) {
      setBillingData({...billingData, usageCap: newData})
    }
  }
  
  const handleAddCard = () => {
    if (isDemoMode) {
      alert('Demo mode: Stripe integration disabled')
      return
    }
    // In production, this would open Stripe Elements
    alert('Stripe Elements integration coming soon!')
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 mr-3" />
            <div>
              <div className="text-sm text-amber-800">
                {t('settings.billing.load_warning', 'Some billing data could not be loaded. Showing safe defaults.')}
              </div>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            disabled={import.meta.env.VITE_DEMO_MODE === 'true'}
            className={`mt-4 px-4 py-2 rounded-lg ${
              import.meta.env.VITE_DEMO_MODE === 'true'
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
            title={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Disabilitato in demo' : ''}
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      </div>
    )
  }
  
  // No data state
  if (!billingData) {
    return (
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 mr-3" />
            <div>
              <div className="text-sm text-amber-800">
                {t('settings.billing.load_warning', 'Some billing data could not be loaded. Showing safe defaults.')}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Demo Banner */}
      {isDemoMode && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <strong>Demo mode</strong> — le azioni di pagamento/ricarica sono disabilitate in questa istanza.
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('settings.billing.title') || 'Billing'}
        </h1>
        <p className="text-sm text-gray-600">
          {t('settings.billing.subtitle') || 'Manage your budget and usage limits'}
        </p>
      </div>

      {/* Stripe Status Banner */}
      <PaymentsDisabledBanner />

      {/* Overview Cards */}
      <OverviewCards data={billingData} />
      
      {/* Payment Methods */}
      <PaymentMethods data={billingData?.paymentMethods ?? []} onAddCard={handleAddCard} />
      
      {/* Auto-Recharge */}
      <AutoRecharge data={billingData?.autoRecharge ?? {}} onUpdate={handleAutoRechargeUpdate} />
      
      {/* Usage Cap */}
      <UsageCap data={billingData?.usageCap ?? {}} onUpdate={handleUsageCapUpdate} />
      
      {/* Budget & Limits */}
      <BudgetAndLimits />
      
      {/* Invoices */}
      <Invoices data={billingData?.invoices ?? []} />
    </div>
  )
}



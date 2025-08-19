import React, { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n.jsx'
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
  balance: 125.50,
  usage: {
    mtd: 89.30,
    cap: 200.00,
    minutes: 1250,
    minutesCap: 2000
  },
  autoRecharge: {
    enabled: true,
    threshold: 50.00,
    topup: 200.00
  },
  usageCap: {
    type: 'soft', // 'hard' or 'soft'
    limit: 200.00,
    warning: 160.00
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
    }
  ],
  invoices: [
    {
      id: 'inv_1',
      number: 'INV-2025-001',
      period: 'January 2025',
      amount: 89.30,
      status: 'paid',
      date: '2025-01-15'
    }
  ]
}

function OverviewCards({ data }) {
  const { t } = useI18n()
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {/* Balance */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-lg">
            <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">
              {t('billing.overview.balance') || 'Available Balance'}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              ${data.balance.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Usage MTD */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ClockIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">
              {t('billing.overview.usage_mtd') || 'Usage MTD'}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              ${data.usage.mtd.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">
              of ${data.usage.cap.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Minutes MTD */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ClockIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">
              {t('billing.overview.minutes_mtd') || 'Minutes MTD'}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {data.usage.minutes}
            </p>
            <p className="text-sm text-gray-500">
              of {data.usage.minutesCap}
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center">
          <div className="p-2 bg-gray-100 rounded-lg">
            <CheckCircleIcon className="h-6 w-6 text-gray-600" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600">
              {t('billing.overview.status') || 'Status'}
            </p>
            <p className="text-lg font-semibold text-green-600">
              Active
            </p>
            <p className="text-sm text-gray-500">
              {data.usage.mtd / data.usage.cap * 100 < 80 ? 'Normal' : 'Near Limit'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentMethods({ data, onAddCard }) {
  const { t } = useI18n()
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('billing.payment_methods.title') || 'Payment Methods'}
        </h3>
        <button
          onClick={onAddCard}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('billing.payment_methods.add') || 'Add Card'}
        </button>
      </div>
      
      <div className="space-y-4">
        {data.paymentMethods.map((method) => (
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
                  {t('billing.payment_methods.default') || 'Default'}
                </span>
              )}
              <button className="text-sm text-gray-600 hover:text-gray-800">
                {t('common.edit') || 'Edit'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AutoRecharge({ data, onUpdate }) {
  const { t } = useI18n()
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
          {t('billing.auto_recharge.title') || 'Auto-Recharge'}
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-green-600 hover:text-green-800 font-medium"
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
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRechargeEnabled" className="ml-2 text-sm text-gray-700">
              {t('billing.auto_recharge.enable') || 'Enable auto-recharge'}
            </label>
          </div>
          
          {formData.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('billing.auto_recharge.threshold') || 'Recharge when balance falls below'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({...formData, threshold: parseFloat(e.target.value)})}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('billing.auto_recharge.topup') || 'Recharge amount'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.topup}
                    onChange={(e) => setFormData({...formData, topup: parseFloat(e.target.value)})}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
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
                {data.enabled ? t('billing.auto_recharge.enabled') : t('billing.auto_recharge.disabled')}
              </p>
              {data.enabled && (
                <p className="text-sm text-gray-500">
                  {t('billing.auto_recharge.description', {
                    threshold: data.threshold,
                    topup: data.topup
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
  const { t } = useI18n()
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
          {t('billing.usage_cap.title') || 'Usage Cap'}
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm text-green-600 hover:text-green-800 font-medium"
        >
          {isEditing ? t('common.cancel') : t('common.edit')}
        </button>
      </div>
      
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('billing.usage_cap.type') || 'Cap Type'}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="soft">{t('billing.usage_cap.soft') || 'Soft Cap (warnings only)'}</option>
              <option value="hard">{t('billing.usage_cap.hard') || 'Hard Cap (stop calls)'}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('billing.usage_cap.limit') || 'Monthly Limit ($)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={formData.limit}
                onChange={(e) => setFormData({...formData, limit: parseFloat(e.target.value)})}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
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
                {data.type === 'hard' ? t('billing.usage_cap.hard_cap') : t('billing.usage_cap.soft_cap')}
              </p>
              <p className="text-sm text-gray-500">
                {t('billing.usage_cap.description', {
                  limit: data.limit,
                  type: data.type === 'hard' ? t('billing.usage_cap.stop_calls') : t('billing.usage_cap.warnings_only')
                }) || `Limit: $${data.limit} - ${data.type === 'hard' ? 'Stop calls at limit' : 'Warnings only'}`}
              </p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              data.type === 'hard' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {data.type === 'hard' ? t('billing.usage_cap.hard') : t('billing.usage_cap.soft')}
            </span>
          </div>
          
          {/* Usage Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{t('billing.usage_cap.current') || 'Current Usage'}</span>
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
  const { t } = useI18n()
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {t('billing.invoices.title') || 'Recent Invoices'}
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
                {t('billing.invoices.download') || 'Download'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <button className="text-sm text-green-600 hover:text-green-800 font-medium">
          {t('billing.invoices.view_all') || 'View All Invoices'}
        </button>
      </div>
    </div>
  )
}

// Main Billing component
export default function Billing() {
  const { t } = useI18n()
  const [billingData, setBillingData] = useState(mockBillingData)
  
  const handleAutoRechargeUpdate = (newData) => {
    setBillingData({...billingData, autoRecharge: newData})
  }
  
  const handleUsageCapUpdate = (newData) => {
    setBillingData({...billingData, usageCap: newData})
  }
  
  const handleAddCard = () => {
    // In production, this would open Stripe Elements
    alert('Stripe Elements integration coming soon!')
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {t('billing.title') || 'Billing & Usage'}
        </h1>
        <p className="text-gray-600">
          {t('billing.subtitle') || 'Manage your payment methods, auto-recharge, and usage limits'}
        </p>
      </div>

      {/* Overview Cards */}
      <OverviewCards data={billingData} />
      
      {/* Payment Methods */}
      <PaymentMethods data={billingData.paymentMethods} onAddCard={handleAddCard} />
      
      {/* Auto-Recharge */}
      <AutoRecharge data={billingData.autoRecharge} onUpdate={handleAutoRechargeUpdate} />
      
      {/* Usage Cap */}
      <UsageCap data={billingData.usageCap} onUpdate={handleUsageCapUpdate} />
      
      {/* Invoices */}
      <Invoices data={billingData.invoices} />
    </div>
  )
}



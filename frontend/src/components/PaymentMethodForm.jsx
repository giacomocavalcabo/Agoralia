import React, { useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { useI18n } from '../lib/i18n.jsx'
import { apiFetch } from '../lib/api.js'

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
}

export default function PaymentMethodForm({ onSuccess, onCancel }) {
  const { t } = useI18n('pages')
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  // Check if Stripe is available
  if (!stripe || !elements) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-4">
          {t('billing.payment_methods.unavailable') || 'Payment System Unavailable'}
        </h3>
        <p className="text-yellow-700 mb-4">
          {t('billing.payment_methods.unavailable_desc') || 'Stripe payment system is not configured. Please contact your administrator.'}
        </p>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-yellow-600 hover:text-yellow-800 font-medium"
        >
          {t('common.close') || 'Close'}
        </button>
      </div>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    
    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Create SetupIntent on the backend
      const { clientSecret } = await apiFetch('/billing/setup-intent', {
        method: 'POST'
      })

      // Confirm the SetupIntent
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: 'Card Holder Name', // In production, get from form
            },
          },
        }
      )

      if (confirmError) {
        setError(confirmError.message)
      } else {
        // Payment method successfully attached
        onSuccess({
          id: setupIntent.payment_method,
          type: 'card',
          last4: setupIntent.payment_method.card.last4,
          brand: setupIntent.payment_method.card.brand,
          expMonth: setupIntent.payment_method.card.exp_month,
          expYear: setupIntent.payment_method.card.exp_year,
        })
      }
    } catch (err) {
      setError('Failed to add payment method. Please try again.')
      console.error('Payment method error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('billing.payment_methods.add_card') || 'Add Payment Method'}
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('billing.payment_methods.card_details') || 'Card Details'}
          </label>
          <div className="border border-gray-300 rounded-lg p-3 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {t('billing.payment_methods.adding') || 'Adding...'}
              </div>
            ) : (
              t('billing.payment_methods.add') || 'Add Card'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

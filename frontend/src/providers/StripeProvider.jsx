import React from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

// Stripe publishable key - se manca, i pagamenti sono disabilitati
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''

// Feature flag per i pagamenti
export const PaymentsEnabled = !!STRIPE_PUBLISHABLE_KEY

// Stripe promise - solo se la chiave è configurata
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null

export default function StripeProvider({ children }) {
  // Se Stripe non è configurato, mostra warning e passa i children senza Elements
  if (!PaymentsEnabled) {
    console.warn('Stripe disabled: missing VITE_STRIPE_PUBLISHABLE_KEY')
    return <>{children}</>
  }
  
  // Se Stripe è configurato, wrappa con Elements
  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  )
}

// Hook per verificare se i pagamenti sono abilitati
export function usePaymentsEnabled() {
  return PaymentsEnabled
}

// Componente per mostrare banner quando i pagamenti sono disabilitati
export function PaymentsDisabledBanner() {
  if (PaymentsEnabled) return null
  
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Pagamenti disabilitati
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Per abilitare i pagamenti, configura la chiave pubblica Stripe nell'ambiente.
            </p>
          </div>
          <div className="mt-4">
            <div className="text-sm text-yellow-700">
              <p className="font-medium">Variabile richiesta:</p>
              <code className="bg-yellow-100 px-2 py-1 rounded text-xs">
                VITE_STRIPE_PUBLISHABLE_KEY
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

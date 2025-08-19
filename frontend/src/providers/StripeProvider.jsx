import React, { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function StripeProvider({ children }) {
  const [stripeLoaded, setStripeLoaded] = useState(false)

  useEffect(() => {
    if (stripePromise) {
      stripePromise.then(() => setStripeLoaded(true))
    }
  }, [])

  if (!stripeLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment system...</p>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  )
}

import React, { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

// Only load Stripe if we have a valid API key
const stripePromise = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.startsWith('pk_') 
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null

export default function StripeProvider({ children }) {
  const [stripeLoaded, setStripeLoaded] = useState(false)
  const [stripeError, setStripeError] = useState(null)

  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      console.warn('Stripe publishable key not found. Payment features will be disabled.')
      setStripeLoaded(true) // Allow app to continue without Stripe
      return
    }

    if (!STRIPE_PUBLISHABLE_KEY.startsWith('pk_')) {
      setStripeError('Invalid Stripe publishable key format')
      setStripeLoaded(true)
      return
    }

    if (stripePromise) {
      stripePromise
        .then((stripe) => {
          if (stripe) {
            setStripeLoaded(true)
          } else {
            setStripeError('Failed to load Stripe')
            setStripeLoaded(true)
          }
        })
        .catch((error) => {
          console.error('Stripe loading error:', error)
          setStripeError(error.message)
          setStripeLoaded(true)
        })
    } else {
      setStripeLoaded(true)
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

  if (stripeError) {
    console.warn('Stripe error:', stripeError)
    // Continue without Stripe Elements wrapper
    return children
  }

  if (!stripePromise) {
    // No Stripe key, continue without Stripe Elements wrapper
    return children
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  )
}

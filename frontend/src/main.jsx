// Importa e inizializza i18n PRIMA del render
import './lib/i18n.jsx'
import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StripeProvider from './providers/StripeProvider'
import Root from './layouts/Root'
import './index.css'

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
  </div>
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <StripeProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Root />
          </Suspense>
        </BrowserRouter>
      </StripeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)

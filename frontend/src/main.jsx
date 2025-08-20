import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StripeProvider from './providers/StripeProvider'
import Root from './layouts/Root'
import './index.css'

// Lazy load components
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const KnowledgeBase = React.lazy(() => import('./pages/KnowledgeBase/KnowledgeBase'))
const KBEditor = React.lazy(() => import('./pages/KnowledgeBase/KBEditor'))
const Assignments = React.lazy(() => import('./pages/KnowledgeBase/Assignments'))
const Imports = React.lazy(() => import('./pages/KnowledgeBase/Imports'))
const Leads = React.lazy(() => import('./pages/Leads'))
const Numbers = React.lazy(() => import('./pages/Numbers'))
const Campaigns = React.lazy(() => import('./pages/Campaigns'))
const Settings = React.lazy(() => import('./pages/Settings'))
const Billing = React.lazy(() => import('./pages/Billing'))

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

import React from 'react'
import { useTranslation } from 'react-i18next'

class AppErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // Log only in dev
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: null, errorInfo: null })
            window.location.reload()
          }}
        />
      )
    }

    return this.props.children
  }
}

function ErrorFallback({ error, onRetry }) {
  // usa sia 'common' sia 'pages' per massima resilienza
  const { t } = useTranslation(['common','pages'])
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {t('error.boundary.title', { ns: 'common' })}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {t('error.boundary.description', { ns: 'common' })}
        </p>
        
        {import.meta.env.DEV && error && (
          <details className="text-left mb-4 text-xs bg-gray-100 p-3 rounded">
            <summary className="font-medium cursor-pointer">Error Details (Dev Only)</summary>
            <pre className="mt-2 text-red-600 whitespace-pre-wrap">{error.toString()}</pre>
          </details>
        )}
        
        <button
          onClick={onRetry}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('error.boundary.retry', { ns: 'common' })}
        </button>
      </div>
    </div>
  )
}

export default function AppErrorBoundary({ children }) {
  return (
    <AppErrorBoundaryInner>
      {children}
    </AppErrorBoundaryInner>
  )
}

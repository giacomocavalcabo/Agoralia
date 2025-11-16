import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    // TODO: hook to telemetry here
    console.error('UI Error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Something went wrong</h2>
          <div style={{ color: '#6b7280', marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {String(this.state.error || '')}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}



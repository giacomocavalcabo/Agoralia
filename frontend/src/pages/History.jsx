import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api.js'
import { useToast } from '../components/ToastProvider.jsx'

export default function History() {
  const { t } = useTranslation('pages')
  const { toast } = useToast()
  const [outcomes, setOutcomes] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    campaign: '',
    next_step: '',
    score_min: '',
    score_max: '',
    country: '',
    lang: '',
    agent: ''
  })
  const [selectedOutcome, setSelectedOutcome] = useState(null)
  const [reviewDrawer, setReviewDrawer] = useState({ open: false, outcome: null })

  const NEXT_STEPS = ['Send quote', 'Book demo', 'Follow-up call', 'Disqualify', 'Close deal', 'Schedule meeting']
  const SCORE_RANGES = ['0-25', '26-50', '51-75', '76-100']

  async function loadOutcomes() {
    setLoading(true)
    try {
      const res = await apiFetch('/outcomes')
      setOutcomes(res.items || [])
    } catch (e) {
      toast('Failed to load outcomes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOutcomes()
  }, [])

  function openReview(outcome) {
    setReviewDrawer({ open: true, outcome })
  }

  function getScoreColor(score) {
    if (score >= 75) return 'bg-success text-success-foreground'
    if (score >= 50) return 'bg-warn text-warn-foreground'
    return 'bg-danger text-danger-foreground'
  }

  function getSentimentIcon(sentiment) {
    if (sentiment > 0.3) return '😊'
    if (sentiment < -0.3) return '😞'
    return '😐'
  }

  const filteredOutcomes = useMemo(() => {
    return outcomes.filter(outcome => {
      if (filters.campaign && outcome.campaign_id !== filters.campaign) return false
      if (filters.next_step && outcome.next_step !== filters.next_step) return false
      if (filters.score_min && outcome.score_lead < parseInt(filters.score_min)) return false
      if (filters.score_max && outcome.score_lead > parseInt(filters.score_max)) return false
      if (filters.country && outcome.iso !== filters.country) return false
      if (filters.lang && outcome.lang !== filters.lang) return false
      if (filters.agent && outcome.agent_id !== filters.agent) return false
      return true
    })
  }, [outcomes, filters])

  return (
    <div className="grid gap-3">
      <div className="panel">
        <div className="kpi-title mb-4">{t('pages.history.title') || 'Call History & Outcomes'}</div>
        
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <label>
            <div className="text-sm text-gray-600 mb-1">Campaign</div>
            <select 
              value={filters.campaign} 
              onChange={e => setFilters({ ...filters, campaign: e.target.value })}
              className="input"
            >
              <option value="">All campaigns</option>
              <option value="c_1">RFQ IT</option>
              <option value="c_2">Demo EN</option>
            </select>
          </label>
          
          <label>
            <div className="text-sm text-gray-600 mb-1">Next Step</div>
            <select 
              value={filters.next_step} 
              onChange={e => setFilters({ ...filters, next_step: e.target.value })}
              className="input"
            >
              <option value="">All steps</option>
              {NEXT_STEPS.map(step => (
                <option key={step} value={step}>{step}</option>
              ))}
            </select>
          </label>
          
          <label>
            <div className="text-sm text-gray-600 mb-1">Score Min</div>
            <input 
              type="number" 
              min="0" 
              max="100"
              value={filters.score_min} 
              onChange={e => setFilters({ ...filters, score_min: e.target.value })}
              className="input"
              placeholder="0"
            />
          </label>
          
          <label>
            <div className="text-sm text-gray-600 mb-1">Score Max</div>
            <input 
              type="number" 
              min="0" 
              max="100"
              value={filters.score_max} 
              onChange={e => setFilters({ ...filters, score_max: e.target.value })}
              className="input"
              placeholder="100"
            />
          </label>
        </div>

        {/* Results count and export */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            {filteredOutcomes.length} outcomes
          </div>
          <button className="btn" onClick={() => toast('Export feature coming soon')}>
            Export CSV
          </button>
        </div>

        {/* Outcomes table */}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Call ID</th>
                <th>Campaign</th>
                <th>Outcome</th>
                <th>Score</th>
                <th>Next Step</th>
                <th>Sentiment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOutcomes.map(outcome => (
                <tr key={outcome.id}>
                  <td className="font-mono text-sm">{outcome.call_id}</td>
                  <td>{outcome.campaign_id}</td>
                  <td>
                    <div className="text-sm font-medium">{outcome.template_name}</div>
                    <div className="text-xs text-gray-600">
                      {outcome.ai_summary_short?.substring(0, 50)}...
                    </div>
                  </td>
                  <td>
                    <span className={`px-2 py-1 text-xs rounded-full ${getScoreColor(outcome.score_lead)}`}>
                      {outcome.score_lead}/100
                    </span>
                  </td>
                  <td>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {outcome.next_step}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span>{getSentimentIcon(outcome.sentiment)}</span>
                      <span className="text-xs">{(outcome.sentiment * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td>
                    <button 
                      className="btn-sm" 
                      onClick={() => openReview(outcome)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredOutcomes.length && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    {loading ? 'Loading...' : 'No outcomes found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Post-call Review Drawer */}
      {reviewDrawer.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                Call Outcome Review - {reviewDrawer.outcome?.template_name}
              </h3>
              <button 
                onClick={() => setReviewDrawer({ open: false, outcome: null })}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column - Key facts & actions */}
              <div className="space-y-4">
                <div className="panel">
                  <div className="kpi-title mb-3">Key Facts</div>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Call ID:</span> {reviewDrawer.outcome?.call_id}</div>
                    <div><span className="font-medium">Campaign:</span> {reviewDrawer.outcome?.campaign_id}</div>
                    <div><span className="font-medium">Template:</span> {reviewDrawer.outcome?.template_name}</div>
                    <div><span className="font-medium">Score:</span> 
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getScoreColor(reviewDrawer.outcome?.score_lead)}`}>
                        {reviewDrawer.outcome?.score_lead}/100
                      </span>
                    </div>
                    <div><span className="font-medium">Sentiment:</span> 
                      <span className="ml-2">{getSentimentIcon(reviewDrawer.outcome?.sentiment)}</span>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="kpi-title mb-3">Action Items</div>
                  <div className="space-y-2">
                    {(reviewDrawer.outcome?.action_items_json || []).map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-blue-600">•</span>
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                    {!reviewDrawer.outcome?.action_items_json?.length && (
                      <div className="text-sm text-gray-500">No action items</div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="kpi-title mb-3">Next Step</div>
                  <select 
                    value={reviewDrawer.outcome?.next_step || ''} 
                    onChange={e => {
                      // Update outcome next step
                      setReviewDrawer({
                        ...reviewDrawer,
                        outcome: { ...reviewDrawer.outcome, next_step: e.target.value }
                      })
                    }}
                    className="input"
                  >
                    {NEXT_STEPS.map(step => (
                      <option key={step} value={step}>{step}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right column - Tabs */}
              <div className="space-y-4">
                <div className="panel">
                  <div className="kpi-title mb-3">Summary</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-600">Short Summary</div>
                      <div className="text-sm">{reviewDrawer.outcome?.ai_summary_short || 'No summary available'}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Long Summary</div>
                      <div className="text-sm">{reviewDrawer.outcome?.ai_summary_long || 'No detailed summary available'}</div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="kpi-title mb-3">Form Fields</div>
                  <div className="space-y-2">
                    {Object.entries(reviewDrawer.outcome?.fields_json || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-sm font-medium text-gray-600">{key}:</span>
                        <span className="text-sm">{String(value)}</span>
                      </div>
                    ))}
                    {!Object.keys(reviewDrawer.outcome?.fields_json || {}).length && (
                      <div className="text-sm text-gray-500">No form data</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setReviewDrawer({ open: false, outcome: null })}
                className="btn-secondary flex-1"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  toast('Outcome updated')
                  setReviewDrawer({ open: false, outcome: null })
                  loadOutcomes()
                }}
                className="btn flex-1"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



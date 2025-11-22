import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useRetellCalls, type RetellCallsFilters } from '../hooks'
import { type RetellCall } from '../api'
import { Calendar, Filter, Layout, Settings, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export function CallsPage() {
  const [filters, setFilters] = useState<RetellCallsFilters>({
    sort_order: 'descending',
    limit: 50,
  })
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({})
  
  const { data: callsData, isLoading, error, refetch } = useRetellCalls(filters)
  const calls = callsData?.calls || []
  
  const formatDuration = (durationMs?: number): string => {
    if (!durationMs && durationMs !== 0) return '-'
    const seconds = Math.floor(durationMs / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  const formatCost = (call?: RetellCall): string => {
    // Cost is in cents in call_cost.combined_cost
    const costCents = call?.call_cost?.combined_cost
    if (!costCents && costCents !== 0) return '$0.000'
    const costDollars = costCents / 100
    return `$${costDollars.toFixed(3)}`
  }
  
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return format(date, 'yyyy-MM-dd HH:mm:ss') + ' CET'
  }
  
  const getStatusBadge = (call?: RetellCall) => {
    const status = call?.call_status
    const disconnectionReason = call?.disconnection_reason
    if (status === 'ended' && disconnectionReason === 'user_hangup') {
      return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>ended</span>
    }
    if (status === 'not_connected' || disconnectionReason === 'dial_failed') {
      return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>not_connected</span>
    }
    if (status === 'ended') {
      return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span>ended</span>
    }
    return <span className="text-sm">{status || '-'}</span>
  }
  
  const getEndReasonBadge = (disconnectionReason?: string) => {
    if (disconnectionReason === 'user_hangup') {
      return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>user hangup</span>
    }
    if (disconnectionReason === 'dial_failed') {
      return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>dial failed</span>
    }
    return <span className="text-sm">{disconnectionReason || '-'}</span>
  }
  
  const getChannelType = (call?: RetellCall): string => {
    return call?.call_type || 'phone_call'
  }
  
  const getUserSentiment = (call?: RetellCall): string => {
    return call?.call_analysis?.user_sentiment || 'Unknown'
  }
  
  const getSessionOutcome = (call?: RetellCall): string => {
    const successful = call?.call_analysis?.call_successful
    if (successful === true) return 'Successful'
    if (successful === false) return 'Unsuccessful'
    return '-'
  }
  
  const getEndToEndLatency = (call?: RetellCall): string => {
    const e2e = call?.latency?.e2e
    if (!e2e) return '-'
    // Use p50 as the representative value, or max if p50 not available
    const latencyMs = e2e.p50 || e2e.max || e2e.p90
    return latencyMs ? `${latencyMs}ms` : '-'
  }
  
  const handleDateRangeChange = (start?: string, end?: string) => {
    setDateRange({ start, end })
    if (start && end) {
      const startTs = new Date(start).getTime()
      const endTs = new Date(end).getTime()
      setFilters({
        ...filters,
        filter_criteria: {
          ...filters.filter_criteria,
          start_timestamp: {
            lower_threshold: startTs,
            upper_threshold: endTs,
          },
        },
      })
    }
  }
  
  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export calls')
  }
  
  const totalCalls = callsData?.total_calls || calls.length
  const hasNextPage = !!callsData?.pagination_key
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calls</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your call history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDateRangeChange()}>
            <Calendar className="h-4 w-4 mr-2" />
            Date Range
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Layout className="h-4 w-4 mr-2" />
            Customize View
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Custom Attributes
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading calls...</div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-sm text-destructive">Error loading calls: {error.message}</p>
        </div>
      ) : !calls || calls.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No calls found.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Channel Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">End Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User Sentiment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">From</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">End to End Latency</th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {calls.map((call) => (
                  <tr key={call.call_id || call.session_id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatTimestamp(call.start_timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatDuration(call.duration_ms)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getChannelType(call)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {formatCost(call)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap font-mono text-xs">
                      {call.session_id || call.call_id || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getEndReasonBadge(call.disconnection_reason)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getStatusBadge(call)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getUserSentiment(call)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {call.from_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {call.to_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {call.direction || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getSessionOutcome(call)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {getEndToEndLatency(call)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Footer with Pagination */}
      {calls.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page 1 of {Math.ceil(totalCalls / (filters.limit || 50))} • Total Sessions: {totalCalls}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!filters.pagination_key}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              1
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNextPage}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <select className="px-2 py-1 rounded border border-input bg-background">
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
              <option value="200">200 / page</option>
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

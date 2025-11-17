import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SetupChecklist } from '../components/SetupChecklist'
import { KPICard } from '../components/KPICard'
import { useDashboardKPIs, useLiveCalls } from '../hooks'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { useWebSocket } from '@/shared/hooks/useWebSocket'
import { Button } from '@/shared/ui/button'
import { CheckCircle2, Phone } from 'lucide-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs()
  const { data: liveCalls, isLoading: callsLoading } = useLiveCalls()

  // WebSocket integration for real-time updates
  useWebSocket({
    onMessage: (message) => {
      // Invalidate relevant queries when call events occur
      if (message.type === 'call.created' || message.type === 'call.finished' || message.type === 'webcall.created') {
        queryClient.invalidateQueries({ queryKey: ['calls'] })
        queryClient.invalidateQueries({ queryKey: ['calls', 'live'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
  })

  // Fetch setup status
  const { data: numbers } = useQuery({
    queryKey: ['numbers'],
    queryFn: async () => {
      const { data } = await api.get('/numbers')
      return Array.isArray(data) ? data : []
    },
  })

  const { data: kbs } = useQuery({
    queryKey: ['kbs'],
    queryFn: async () => {
      const { data } = await api.get('/kbs')
      return Array.isArray(data) ? data : []
    },
  })

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data } = await api.get('/agents')
      return Array.isArray(data) ? data : []
    },
  })

  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'count'],
    queryFn: async () => {
      const { data } = await api.get('/leads', { params: { limit: 1 } })
      return data?.total ?? 0
    },
  })

  const hasNumbers = (numbers?.length ?? 0) > 0 && numbers?.some((n: any) => n.verified)
  const hasKnowledge = (kbs?.length ?? 0) > 0
  const hasAgent = (agents?.length ?? 0) > 0
  const hasLeads = (leadsData ?? 0) > 0

  const setupItems = [
    {
      id: 'number',
      type: 'number' as const,
      label: 'Phone number',
      description: 'Add a verified phone number to make outbound calls',
      completed: hasNumbers,
      onAction: () => navigate('/numbers'),
    },
    {
      id: 'knowledge',
      type: 'knowledge' as const,
      label: 'Knowledge base',
      description: 'Provide context and information for your AI agent',
      completed: hasKnowledge,
      onAction: () => navigate('/knowledge'),
    },
    {
      id: 'agent',
      type: 'agent' as const,
      label: 'AI agent',
      description: 'Configure your voice AI agent for calls',
      completed: hasAgent,
      onAction: () => navigate('/agents'),
    },
    {
      id: 'leads',
      type: 'leads' as const,
      label: 'Leads',
      description: 'Import contacts who will receive calls',
      completed: hasLeads,
      onAction: () => navigate('/leads'),
    },
  ]

  const totalCompleted = setupItems.filter((item) => item.completed).length
  const isSetupComplete = totalCompleted === 4

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your campaigns and calls
          </p>
        </div>
        {isSetupComplete && (
          <Button onClick={() => navigate('/campaigns/new')} size="lg">
            Create campaign
          </Button>
        )}
      </div>

      {!isSetupComplete && (
        <SetupChecklist
          items={setupItems}
          totalCompleted={totalCompleted}
          totalItems={4}
          onStartSetup={() => navigate('/setup')}
        />
      )}

      {isSetupComplete && (
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">System ready</p>
              <p className="text-xs text-muted-foreground">
                All setup steps completed. You can now create campaigns.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Active calls"
          value={kpis?.active_calls ?? 0}
          loading={kpisLoading}
        />
        <KPICard
          label="Cost today"
          value={`€${((kpis?.cost_today ?? 0) / 100).toFixed(2)}`}
          loading={kpisLoading}
        />
        <KPICard
          label="Total calls"
          value={kpis?.total_calls ?? 0}
          loading={kpisLoading}
        />
        <KPICard
          label="Successful calls"
          value={kpis?.calls_successful ?? 0}
          loading={kpisLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Live calls</CardTitle>
            {liveCalls && liveCalls.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {liveCalls.length} active
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {callsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : liveCalls && liveCalls.length > 0 ? (
            <div className="space-y-2">
              {liveCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/calls/${call.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {call.to || call.to_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {call.from || call.from_number} • {call.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No active calls</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

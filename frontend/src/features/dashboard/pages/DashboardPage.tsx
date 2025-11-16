import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { SetupChecklist } from '../components/SetupChecklist'
import { KPICard } from '../components/KPICard'
import { useDashboardKPIs, useLiveCalls } from '../hooks'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs()
  const { data: liveCalls, isLoading: callsLoading } = useLiveCalls()

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
      label: 'Numero telefonico',
      description: 'Serve almeno un numero attivo per chiamare i tuoi clienti',
      completed: hasNumbers,
      onAction: () => navigate('/numbers'),
    },
    {
      id: 'knowledge',
      type: 'knowledge' as const,
      label: 'Knowledge Base',
      description: 'La KB fornisce informazioni al tuo agent durante le chiamate',
      completed: hasKnowledge,
      onAction: () => navigate('/knowledge'),
    },
    {
      id: 'agent',
      type: 'agent' as const,
      label: 'Agent',
      description: "L'agent è la voce AI che farà le chiamate per te",
      completed: hasAgent,
      onAction: () => navigate('/agents'),
    },
    {
      id: 'leads',
      type: 'leads' as const,
      label: 'Leads',
      description: 'I leads sono i contatti che riceveranno le chiamate',
      completed: hasLeads,
      onAction: () => navigate('/leads'),
    },
  ]

  const totalCompleted = setupItems.filter((item) => item.completed).length
  const isSetupComplete = totalCompleted === 4

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Overview delle tue campagne e chiamate"
        primaryAction={
          isSetupComplete
            ? {
                label: 'Crea Campagna',
                onClick: () => navigate('/campaigns/new'),
              }
            : undefined
        }
      />

      {!isSetupComplete && (
        <SetupChecklist
          items={setupItems}
          totalCompleted={totalCompleted}
          totalItems={4}
          onStartSetup={() => navigate('/setup')}
        />
      )}

      {isSetupComplete && (
        <div className="rounded-lg border bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
          ✅ Sistema pronto per chiamare
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Chiamate attive"
          value={kpis?.active_calls ?? 0}
          loading={kpisLoading}
        />
        <KPICard
          label="Costo oggi"
          value={`€${((kpis?.cost_today ?? 0) / 100).toFixed(2)}`}
          loading={kpisLoading}
        />
        <KPICard
          label="Chiamate totali"
          value={kpis?.total_calls ?? 0}
          loading={kpisLoading}
        />
        <KPICard
          label="Chiamate riuscite"
          value={kpis?.calls_successful ?? 0}
          loading={kpisLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chiamate live</CardTitle>
        </CardHeader>
        <CardContent>
          {callsLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Caricamento...</div>
          ) : liveCalls && liveCalls.length > 0 ? (
            <div className="space-y-2">
              {liveCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">{call.to_number}</div>
                    <div className="text-sm text-muted-foreground">
                      Da: {call.from_number} • {call.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Nessuna chiamata attiva
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


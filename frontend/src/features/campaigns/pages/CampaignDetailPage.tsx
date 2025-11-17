import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useCampaign } from '../hooks'
import { useLeads } from '@/features/leads/hooks'
import { Play, Pause, ArrowLeft, Phone, DollarSign, Users, Calendar, Settings } from 'lucide-react'
import { useStartCampaign, usePauseCampaign } from '../hooks'

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  running: { label: 'Running', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  paused: { label: 'Paused', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const campaignId = id ? parseInt(id, 10) : null
  const { data: campaign, isLoading, error } = useCampaign(campaignId)
  const { data: leadsData } = useLeads({ campaign_id: campaignId, limit: 50 })
  const startMutation = useStartCampaign()
  const pauseMutation = usePauseCampaign()

  const handleStart = async () => {
    if (!campaignId) return
    try {
      await startMutation.mutateAsync(campaignId)
    } catch (error: any) {
      alert(`Failed to start campaign: ${error.message}`)
    }
  }

  const handlePause = async () => {
    if (!campaignId) return
    try {
      await pauseMutation.mutateAsync(campaignId)
    } catch (error: any) {
      alert(`Failed to pause campaign: ${error.message}`)
    }
  }

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading campaign...</div>
  }

  if (error || !campaign) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">Error loading campaign: {error?.message || 'Not found'}</p>
        </CardContent>
      </Card>
    )
  }

  const leads = leadsData?.items || []
  const status = statusConfig[campaign.status as keyof typeof statusConfig] || statusConfig.draft

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{campaign.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Campaign details and performance
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <Button onClick={handleStart} disabled={startMutation.isPending} size="lg">
              <Play className="mr-2 h-4 w-4" />
              Start campaign
            </Button>
          )}
          {campaign.status === 'running' && (
            <Button variant="outline" onClick={handlePause} disabled={pauseMutation.isPending} size="lg">
              <Pause className="mr-2 h-4 w-4" />
              Pause campaign
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className="text-sm text-muted-foreground">
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Calls made</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-semibold">{campaign.calls_made || 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-semibold">
                €{((campaign.total_cost_cents || 0) / 100).toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-semibold">{leadsData?.total || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg font-semibold">Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Agent ID:</span>
              <span className="ml-2 font-medium">{campaign.agent_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phone Number ID:</span>
              <span className="ml-2 font-medium">{campaign.from_number_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Knowledge Base ID:</span>
              <span className="ml-2 font-medium">{campaign.kb_id || 'N/A'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Timezone:</span>
              <span className="ml-2 font-medium">{campaign.timezone || 'UTC'}</span>
            </div>
            {campaign.start_date && (
              <div>
                <span className="text-muted-foreground">Start date:</span>
                <span className="ml-2 font-medium">
                  {new Date(campaign.start_date).toLocaleString()}
                </span>
              </div>
            )}
            {campaign.end_date && (
              <div>
                <span className="text-muted-foreground">End date:</span>
                <span className="ml-2 font-medium">
                  {new Date(campaign.end_date).toLocaleString()}
                </span>
              </div>
            )}
            {campaign.max_calls_per_day && (
              <div>
                <span className="text-muted-foreground">Max calls/day:</span>
                <span className="ml-2 font-medium">{campaign.max_calls_per_day}</span>
              </div>
            )}
            {campaign.budget_cents && (
              <div>
                <span className="text-muted-foreground">Budget:</span>
                <span className="ml-2 font-medium">€{(campaign.budget_cents / 100).toFixed(2)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Leads</CardTitle>
            </div>
            <span className="text-sm text-muted-foreground">{leadsData?.total || 0} total</span>
          </div>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No leads assigned to this campaign yet.
            </p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{lead.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {lead.phone} {lead.company && `• ${lead.company}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

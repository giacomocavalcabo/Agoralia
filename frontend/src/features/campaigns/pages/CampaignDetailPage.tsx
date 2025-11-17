import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useCampaign } from '../hooks'
import { useLeads } from '@/features/leads/hooks'
import { Play, Pause, ArrowLeft } from 'lucide-react'
import { useStartCampaign, usePauseCampaign } from '../hooks'

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
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
    return <div>Loading campaign...</div>
  }

  if (error || !campaign) {
    return <div className="text-destructive">Error loading campaign: {error?.message || 'Not found'}</div>
  }

  const leads = leadsData?.items || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={campaign.name}
            subtitle={`Status: ${campaign.status}`}
          />
        </div>
        <div className="flex space-x-2">
          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <Button onClick={handleStart} disabled={startMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Start Campaign
            </Button>
          )}
          {campaign.status === 'running' && (
            <Button variant="outline" onClick={handlePause} disabled={pauseMutation.isPending}>
              <Pause className="h-4 w-4 mr-2" />
              Pause Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <Card className={campaign.status === 'running' ? 'border-green-500' : ''}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[campaign.status] || statusColors.draft}`}>
                {campaign.status.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Created: {new Date(campaign.created_at).toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Calls Made</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaign.calls_made || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{((campaign.total_cost_cents || 0) / 100).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadsData?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Agent ID:</span> {campaign.agent_id || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Phone Number ID:</span> {campaign.from_number_id || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Knowledge Base ID:</span> {campaign.kb_id || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Timezone:</span> {campaign.timezone || 'UTC'}
            </div>
            {campaign.start_date && (
              <div>
                <span className="text-muted-foreground">Start Date:</span>{' '}
                {new Date(campaign.start_date).toLocaleString()}
              </div>
            )}
            {campaign.end_date && (
              <div>
                <span className="text-muted-foreground">End Date:</span>{' '}
                {new Date(campaign.end_date).toLocaleString()}
              </div>
            )}
            {campaign.max_calls_per_day && (
              <div>
                <span className="text-muted-foreground">Max Calls/Day:</span> {campaign.max_calls_per_day}
              </div>
            )}
            {campaign.budget_cents && (
              <div>
                <span className="text-muted-foreground">Budget:</span> €
                {(campaign.budget_cents / 100).toFixed(2)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({leadsData?.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-muted-foreground">No leads assigned to this campaign yet.</p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{lead.name}</div>
                    <div className="text-sm text-muted-foreground">
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


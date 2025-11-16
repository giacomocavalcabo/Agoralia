import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useCampaigns, useStartCampaign, usePauseCampaign, useDeleteCampaign } from '../hooks'
import { Plus, Play, Pause, Trash2 } from 'lucide-react'

const statusColors = {
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const { data: campaigns, isLoading, error } = useCampaigns()
  const startMutation = useStartCampaign()
  const pauseMutation = usePauseCampaign()
  const deleteMutation = useDeleteCampaign()

  const handleStart = async (id: number) => {
    try {
      await startMutation.mutateAsync(id)
    } catch (error: any) {
      alert(`Failed to start campaign: ${error.message}`)
    }
  }

  const handlePause = async (id: number) => {
    try {
      await pauseMutation.mutateAsync(id)
    } catch (error: any) {
      alert(`Failed to pause campaign: ${error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error: any) {
        alert(`Failed to delete campaign: ${error.message}`)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Manage your calling campaigns"
        action={
          <Button onClick={() => navigate('/campaigns/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        }
      />

      {isLoading ? (
        <div>Loading campaigns...</div>
      ) : error ? (
        <div className="text-destructive">Error loading campaigns: {error.message}</div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No campaigns yet. Create your first campaign to get started.</p>
            <Button onClick={() => navigate('/campaigns/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="cursor-pointer" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{campaign.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[campaign.status] || statusColors.draft}`}>
                    {campaign.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Calls made:</span> {campaign.calls_made || 0}
                  </div>
                  {campaign.total_cost_cents && (
                    <div>
                      <span className="text-muted-foreground">Total cost:</span> €
                      {((campaign.total_cost_cents || 0) / 100).toFixed(2)}
                    </div>
                  )}
                  {campaign.start_date && (
                    <div className="text-xs text-muted-foreground">
                      Started: {new Date(campaign.start_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                  {campaign.status === 'draft' || campaign.status === 'paused' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStart(campaign.id)}
                      disabled={startMutation.isPending}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  ) : campaign.status === 'running' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePause(campaign.id)}
                      disabled={pauseMutation.isPending}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(campaign.id)}
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


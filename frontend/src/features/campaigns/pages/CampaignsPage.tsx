import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useCampaigns, useStartCampaign, usePauseCampaign, useDeleteCampaign } from '../hooks'
import { Plus, Play, Pause, Trash2, Calendar, DollarSign, Phone } from 'lucide-react'

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  running: { label: 'Running', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  paused: { label: 'Paused', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your calling campaigns
          </p>
        </div>
        <Button onClick={() => navigate('/campaigns/new')} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading campaigns...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading campaigns: {error.message}</p>
          </CardContent>
        </Card>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No campaigns yet. Create your first campaign to get started.
            </p>
            <Button onClick={() => navigate('/campaigns/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const status = statusConfig[campaign.status as keyof typeof statusConfig] || statusConfig.draft
            return (
              <Card
                key={campaign.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">{campaign.name}</CardTitle>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{campaign.calls_made || 0} calls</span>
                    </div>
                    {campaign.total_cost_cents && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>€{((campaign.total_cost_cents || 0) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {campaign.start_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(campaign.start_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    {campaign.status === 'draft' || campaign.status === 'paused' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStart(campaign.id)}
                        disabled={startMutation.isPending}
                        className="flex-1"
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Start
                      </Button>
                    ) : campaign.status === 'running' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePause(campaign.id)}
                        disabled={pauseMutation.isPending}
                        className="flex-1"
                      >
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                        Pause
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(campaign.id)}
                      className="text-destructive hover:text-destructive"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

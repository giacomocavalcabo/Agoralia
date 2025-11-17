import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { useCalls } from '../hooks'
import { Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react'

const statusColors = {
  ringing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'in-progress': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  ended: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
}

export function CallsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [directionFilter, setDirectionFilter] = useState<'inbound' | 'outbound' | ''>('')
  const { data: calls, isLoading, error } = useCalls({
    status: statusFilter || undefined,
    direction: directionFilter || undefined,
    limit: 100,
  })

  const getStatusColor = (status: string) => {
    return statusColors[status as keyof typeof statusColors] || statusColors.ended
  }

  const getDirectionIcon = (direction: string) => {
    if (direction === 'inbound') {
      return <PhoneIncoming className="h-4 w-4" />
    }
    return <PhoneOutgoing className="h-4 w-4" />
  }

  if (isLoading) {
    return <div>Loading calls...</div>
  }

  if (error) {
    return <div className="text-destructive">Error loading calls: {error.message}</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Calls" subtitle="View and manage your call history" />

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Filter by status..."
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as 'inbound' | 'outbound' | '')}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      {!calls || calls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No calls found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <Card
              key={call.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => navigate(`/calls/${call.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getDirectionIcon(call.direction)}
                      <div>
                        <div className="font-medium">
                          {call.direction === 'inbound' ? call.from : call.to}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(call.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                    {call.audio_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(call.audio_url!, '_blank')
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


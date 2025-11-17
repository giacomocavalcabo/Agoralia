import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { useCalls } from '../hooks'
import { Phone, PhoneIncoming, PhoneOutgoing, Search, Filter } from 'lucide-react'

const statusConfig = {
  ringing: { label: 'Ringing', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'in-progress': { label: 'In progress', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  ended: { label: 'Ended', color: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
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

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.ended
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your call history
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by status..."
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as 'inbound' | 'outbound' | '')}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Calls List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading calls...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading calls: {error.message}</p>
          </CardContent>
        </Card>
      ) : !calls || calls.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No calls found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => {
            const status = getStatusConfig(call.status)
            const isInbound = call.direction === 'inbound'
            return (
              <Card
                key={call.id}
                className="cursor-pointer transition-colors hover:border-primary/50"
                onClick={() => navigate(`/calls/${call.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-primary/10 p-2">
                        {isInbound ? (
                          <PhoneIncoming className="h-4 w-4 text-primary" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {isInbound ? call.from : call.to}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {isInbound ? call.to : call.from} • {new Date(call.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      {call.audio_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(call.audio_url!, '_blank')
                          }}
                          className="h-8 w-8"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

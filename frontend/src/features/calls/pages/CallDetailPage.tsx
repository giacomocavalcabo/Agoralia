import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCall, useCallSegments, useUpdateCallDisposition } from '../hooks'
import { ArrowLeft, Phone, Play, PhoneIncoming, PhoneOutgoing, Globe, Calendar, MessageSquare } from 'lucide-react'
import { useState } from 'react'

const statusConfig = {
  ringing: { label: 'Ringing', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  'in-progress': { label: 'In progress', color: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  ended: { label: 'Ended', color: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
}

export function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const callId = id ? parseInt(id, 10) : null
  const { data: call, isLoading, error } = useCall(callId)
  const { data: segments } = useCallSegments(callId)
  const updateDispositionMutation = useUpdateCallDisposition()
  const [dispositionOutcome, setDispositionOutcome] = useState('')
  const [dispositionNote, setDispositionNote] = useState('')

  const handleUpdateDisposition = async () => {
    if (!callId || !dispositionOutcome) return
    try {
      await updateDispositionMutation.mutateAsync({
        callId,
        outcome: dispositionOutcome,
        note: dispositionNote || undefined,
      })
      alert('Disposition updated successfully')
      setDispositionOutcome('')
      setDispositionNote('')
    } catch (error: any) {
      alert(`Failed to update disposition: ${error.message}`)
    }
  }

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading call details...</div>
  }

  if (error || !call) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">Error loading call: {error?.message || 'Not found'}</p>
        </CardContent>
      </Card>
    )
  }

  const status = statusConfig[call.status as keyof typeof statusConfig] || statusConfig.ended
  const isInbound = call.direction === 'inbound'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calls')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Call {call.id}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {call.direction} • {call.status}
            </p>
          </div>
        </div>
        {call.audio_url && (
          <Button variant="outline" onClick={() => window.open(call.audio_url!, '_blank')} size="lg">
            <Play className="mr-2 h-4 w-4" />
            Play audio
          </Button>
        )}
      </div>

      {/* Call Info */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Call information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Direction:</span>
              <div className="flex items-center gap-2">
                {isInbound ? (
                  <PhoneIncoming className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium">{call.direction}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{call.from}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium">{call.to}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium">{call.provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Country:</span>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{call.country_iso || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created:</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{new Date(call.created_at).toLocaleString()}</span>
              </div>
            </div>
            {call.disposition && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Disposition:</span>
                <span className="font-medium">{call.disposition}</span>
              </div>
            )}
            {call.disposition_note && (
              <div className="pt-2 border-t">
                <div className="text-muted-foreground mb-1">Note:</div>
                <div className="text-sm">{call.disposition_note}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Update disposition</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="outcome">Outcome</Label>
              <Input
                id="outcome"
                value={dispositionOutcome}
                onChange={(e) => setDispositionOutcome(e.target.value)}
                placeholder="e.g., successful, no-answer, busy"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={dispositionNote}
                onChange={(e) => setDispositionNote(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="mt-1.5"
              />
            </div>
            <Button
              onClick={handleUpdateDisposition}
              disabled={!dispositionOutcome || updateDispositionMutation.isPending}
              className="w-full"
            >
              {updateDispositionMutation.isPending ? 'Updating...' : 'Update disposition'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transcript Segments */}
      {segments && segments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Transcript</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`rounded-lg border p-3 ${
                    segment.speaker === 'agent'
                      ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 ml-8'
                      : 'border-border bg-muted/30 mr-8'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {segment.speaker === 'agent' ? 'Agent' : 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(segment.start_time_ms / 1000)}s - {Math.round(segment.end_time_ms / 1000)}s
                    </span>
                  </div>
                  <p className="text-sm">{segment.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audio URLs */}
      {call.audio_urls && call.audio_urls.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg font-semibold">Audio files</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {call.audio_urls.map((url, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => window.open(url, '_blank')}
                  className="w-full justify-start"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Audio file {index + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCall, useCallSegments, useUpdateCallDisposition } from '../hooks'
import { ArrowLeft, Phone, Play } from 'lucide-react'
import { useState } from 'react'

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
    return <div>Loading call details...</div>
  }

  if (error || !call) {
    return <div className="text-destructive">Error loading call: {error?.message || 'Not found'}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/calls')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={`Call ${call.id}`}
            subtitle={`${call.direction} • ${call.status}`}
          />
        </div>
        {call.audio_url && (
          <Button
            variant="outline"
            onClick={() => window.open(call.audio_url!, '_blank')}
          >
            <Play className="h-4 w-4 mr-2" />
            Play Audio
          </Button>
        )}
      </div>

      {/* Call Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Call Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Direction:</span> {call.direction}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span> {call.status}
            </div>
            <div>
              <span className="text-muted-foreground">From:</span> {call.from}
            </div>
            <div>
              <span className="text-muted-foreground">To:</span> {call.to}
            </div>
            <div>
              <span className="text-muted-foreground">Provider:</span> {call.provider}
            </div>
            <div>
              <span className="text-muted-foreground">Country:</span> {call.country_iso || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              {new Date(call.created_at).toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Updated:</span>{' '}
              {new Date(call.updated_at).toLocaleString()}
            </div>
            {call.disposition && (
              <div>
                <span className="text-muted-foreground">Disposition:</span> {call.disposition}
              </div>
            )}
            {call.disposition_note && (
              <div>
                <span className="text-muted-foreground">Note:</span> {call.disposition_note}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Disposition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="outcome">Outcome</Label>
              <Input
                id="outcome"
                value={dispositionOutcome}
                onChange={(e) => setDispositionOutcome(e.target.value)}
                placeholder="e.g., successful, no-answer, busy"
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
              />
            </div>
            <Button
              onClick={handleUpdateDisposition}
              disabled={!dispositionOutcome || updateDispositionMutation.isPending}
            >
              {updateDispositionMutation.isPending ? 'Updating...' : 'Update Disposition'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transcript Segments */}
      {segments && segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`p-3 rounded ${
                    segment.speaker === 'agent'
                      ? 'bg-blue-50 dark:bg-blue-950 ml-8'
                      : 'bg-gray-50 dark:bg-gray-900 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
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
            <CardTitle>Audio Files</CardTitle>
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
                  <Phone className="h-4 w-4 mr-2" />
                  Audio File {index + 1}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


import { useState } from 'react'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useKnowledgeBases, useCreateKnowledgeBase, useSyncKnowledgeBase, useDeleteKnowledgeBase } from '../hooks'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const kbSchema = z.object({
  lang: z.string().optional(),
  scope: z.string().optional(),
})

type KbFormInputs = z.infer<typeof kbSchema>

export function KnowledgePage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { data: kbs, isLoading, error } = useKnowledgeBases()
  const createMutation = useCreateKnowledgeBase()
  const syncMutation = useSyncKnowledgeBase()
  const deleteMutation = useDeleteKnowledgeBase()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<KbFormInputs>({
    resolver: zodResolver(kbSchema),
  })

  const onSubmit = async (data: KbFormInputs) => {
    try {
      await createMutation.mutateAsync(data)
      reset()
      setCreateModalOpen(false)
    } catch (error: any) {
      alert(`Failed to create knowledge base: ${error.message}`)
    }
  }

  const handleSync = async (kbId: number) => {
    try {
      await syncMutation.mutateAsync({ kbId, force: false })
      alert('Knowledge base synced successfully')
    } catch (error: any) {
      alert(`Failed to sync knowledge base: ${error.message}`)
    }
  }

  const handleDelete = async (kbId: number) => {
    if (confirm('Are you sure you want to delete this knowledge base?')) {
      try {
        await deleteMutation.mutateAsync(kbId)
      } catch (error: any) {
        alert(`Failed to delete knowledge base: ${error.message}`)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Bases"
        subtitle="Manage your knowledge bases for AI agents"
        action={
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create KB
          </Button>
        }
      />

      {isLoading ? (
        <div>Loading knowledge bases...</div>
      ) : error ? (
        <div className="text-destructive">Error loading knowledge bases: {error.message}</div>
      ) : !kbs || kbs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No knowledge bases yet. Create your first KB to get started.
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create KB
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map((kb) => (
            <Card key={kb.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>KB #{kb.id}</CardTitle>
                  <div className="flex space-x-1">
                    {!kb.synced && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(kb.id)}
                        title="Sync to Retell"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(kb.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Language:</span> {kb.lang || 'N/A'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scope:</span> {kb.scope || 'N/A'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Synced:</span>{' '}
                    {kb.synced ? 'Yes' : 'No'}
                  </div>
                  {kb.retell_kb_id && (
                    <div className="text-xs text-muted-foreground">
                      Retell ID: {kb.retell_kb_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="lang">Language</Label>
              <Input id="lang" {...register('lang')} placeholder="it-IT" error={errors.lang?.message} />
            </div>
            <div>
              <Label htmlFor="scope">Scope</Label>
              <Input id="scope" {...register('scope')} placeholder="general" error={errors.scope?.message} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create KB'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


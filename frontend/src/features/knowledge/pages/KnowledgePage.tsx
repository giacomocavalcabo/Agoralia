import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useKnowledgeBases, useCreateKnowledgeBase, useSyncKnowledgeBase, useDeleteKnowledgeBase } from '../hooks'
import { Plus, Trash2, RefreshCw, BookOpen, Globe, CheckCircle2, XCircle } from 'lucide-react'
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Knowledge bases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your knowledge bases for AI agents
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create KB
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading knowledge bases...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading knowledge bases: {error.message}</p>
          </CardContent>
        </Card>
      ) : !kbs || kbs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No knowledge bases yet. Create your first KB to get started.
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create KB
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Card key={kb.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base font-semibold">KB #{kb.id}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {!kb.synced && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(kb.id)}
                        title="Sync to Retell"
                        className="h-8 w-8"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(kb.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{kb.lang || 'N/A'}</span>
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium">Scope:</span> {kb.scope || 'N/A'}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {kb.synced ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-xs text-muted-foreground">Synced</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs text-muted-foreground">Not synced</span>
                    </>
                  )}
                </div>
                {kb.retell_kb_id && (
                  <div className="pt-1 text-xs text-muted-foreground">
                    Retell ID: {kb.retell_kb_id.substring(0, 12)}...
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create knowledge base</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="lang">Language</Label>
              <Input
                id="lang"
                {...register('lang')}
                placeholder="it-IT"
                error={errors.lang?.message}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="scope">Scope</Label>
              <Input
                id="scope"
                {...register('scope')}
                placeholder="general"
                error={errors.scope?.message}
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
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

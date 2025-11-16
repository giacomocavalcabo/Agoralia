import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useCreateAgent } from '../hooks'

const agentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  lang: z.string().optional(),
  voice_id: z.string().optional(),
})

type AgentFormInputs = z.infer<typeof agentSchema>

interface CreateAgentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateAgentModal({ open, onOpenChange, onSuccess }: CreateAgentModalProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<AgentFormInputs>({
    resolver: zodResolver(agentSchema),
    defaultValues: { lang: 'it-IT', voice_id: '11labs-Adrian' },
  })

  const createMutation = useCreateAgent()

  const onSubmit = async (data: AgentFormInputs) => {
    try {
      await createMutation.mutateAsync(data)
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      alert(`Failed to create agent: ${error.message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} error={errors.name?.message} />
          </div>
          <div>
            <Label htmlFor="lang">Language</Label>
            <Input id="lang" {...register('lang')} placeholder="it-IT" />
          </div>
          <div>
            <Label htmlFor="voice_id">Voice ID</Label>
            <Input id="voice_id" {...register('voice_id')} placeholder="11labs-Adrian" />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


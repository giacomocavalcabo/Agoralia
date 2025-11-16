import { useState } from 'react'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useNumbers, useCreateNumber, useDeleteNumber } from '../hooks'
import { Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const numberSchema = z.object({
  e164: z.string().min(1, 'Phone number is required'),
})

type NumberFormInputs = z.infer<typeof numberSchema>

export function NumbersPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const { data: numbers, isLoading, error } = useNumbers()
  const createMutation = useCreateNumber()
  const deleteMutation = useDeleteNumber()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<NumberFormInputs>({
    resolver: zodResolver(numberSchema),
  })

  const onSubmit = async (data: NumberFormInputs) => {
    try {
      await createMutation.mutateAsync(data)
      reset()
      setCreateModalOpen(false)
    } catch (error: any) {
      alert(`Failed to create number: ${error.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this number?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error: any) {
        alert(`Failed to delete number: ${error.message}`)
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phone Numbers"
        subtitle="Manage your phone numbers for outbound calls"
        action={
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Number
          </Button>
        }
      />

      {isLoading ? (
        <div>Loading numbers...</div>
      ) : error ? (
        <div className="text-destructive">Error loading numbers: {error.message}</div>
      ) : !numbers || numbers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No phone numbers yet. Add your first number to get started.</p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Number
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {numbers.map((number) => (
            <Card key={number.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{number.e164}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(number.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span> {number.type}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Country:</span> {number.country || 'N/A'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verified:</span>{' '}
                    {number.verified ? 'Yes' : 'No'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="e164">Phone Number (E.164 format)</Label>
              <Input
                id="e164"
                {...register('e164')}
                placeholder="+1234567890"
                error={errors.e164?.message}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Number'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


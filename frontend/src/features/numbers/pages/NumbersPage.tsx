import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useNumbers, useCreateNumber, useDeleteNumber } from '../hooks'
import { Plus, Trash2, Phone, CheckCircle2, XCircle, Globe } from 'lucide-react'
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Phone numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your phone numbers for outbound calls
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add number
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading numbers...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading numbers: {error.message}</p>
          </CardContent>
        </Card>
      ) : !numbers || numbers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No phone numbers yet. Add your first number to get started.
            </p>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add number
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {numbers.map((number) => (
            <Card key={number.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base font-semibold">{number.e164}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(number.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Type:</span>
                  <span>{number.type}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{number.country || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {number.verified ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span>Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-amber-600" />
                      <span>Not verified</span>
                    </>
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
            <DialogTitle>Add phone number</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="e164">Phone number (E.164 format)</Label>
              <Input
                id="e164"
                {...register('e164')}
                placeholder="+1234567890"
                error={errors.e164?.message}
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add number'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

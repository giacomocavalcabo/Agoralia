import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { useNumbers, usePurchasePhoneNumber, useImportPhoneNumber, useDeletePhoneNumber } from '../hooks'
import { Plus, Trash2, Phone, CheckCircle2, XCircle, Globe, ShoppingCart, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

// Purchase schema
const purchaseSchema = z.object({
  phone_number: z.string().optional(),
  area_code: z.number().optional(),
  country_code: z.string().optional(),
  number_provider: z.string().optional(), // No default - user must select
  inbound_agent_id: z.string().optional(),
  outbound_agent_id: z.string().optional(),
  inbound_agent_version: z.number().optional(),
  outbound_agent_version: z.number().optional(),
  nickname: z.string().optional(),
  inbound_webhook_url: z.string().url().optional().or(z.literal('')),
  toll_free: z.boolean().optional(),
}).refine((data) => data.phone_number || data.area_code, {
  message: "Either phone_number or area_code is required",
  path: ["phone_number"],
})

// Import schema
const importSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  termination_uri: z.string().min(1, 'Termination URI is required'),
  sip_trunk_user_name: z.string().optional(),
  sip_trunk_password: z.string().optional(),
  inbound_agent_id: z.string().optional(),
  outbound_agent_id: z.string().optional(),
  inbound_agent_version: z.number().optional(),
  outbound_agent_version: z.number().optional(),
  nickname: z.string().optional(),
  inbound_webhook_url: z.string().url().optional().or(z.literal('')),
})

type PurchaseFormInputs = z.infer<typeof purchaseSchema>
type ImportFormInputs = z.infer<typeof importSchema>

export function NumbersPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'purchase' | 'import'>('purchase')
  const { data: numbers, isLoading, error } = useNumbers()
  const purchaseMutation = usePurchasePhoneNumber()
  const importMutation = useImportPhoneNumber()
  const deleteMutation = useDeletePhoneNumber()

  const purchaseForm = useForm<PurchaseFormInputs>({
    resolver: zodResolver(purchaseSchema),
    // No default values - user must select explicitly
  })

  const importForm = useForm<ImportFormInputs>({
    resolver: zodResolver(importSchema),
    // No default values - user must provide explicitly
  })

  const onPurchaseSubmit = async (data: PurchaseFormInputs) => {
    try {
      const payload: any = {}
      if (data.phone_number) payload.phone_number = data.phone_number
      if (data.area_code) payload.area_code = data.area_code
      if (data.country_code) payload.country_code = data.country_code
      if (data.number_provider) payload.number_provider = data.number_provider
      if (data.inbound_agent_id) payload.inbound_agent_id = data.inbound_agent_id
      if (data.outbound_agent_id) payload.outbound_agent_id = data.outbound_agent_id
      if (data.inbound_agent_version) payload.inbound_agent_version = data.inbound_agent_version
      if (data.outbound_agent_version) payload.outbound_agent_version = data.outbound_agent_version
      if (data.nickname) payload.nickname = data.nickname
      if (data.inbound_webhook_url) payload.inbound_webhook_url = data.inbound_webhook_url
      if (data.toll_free !== undefined) payload.toll_free = data.toll_free

      const result = await purchaseMutation.mutateAsync(payload)
      if (result.success) {
        purchaseForm.reset()
        setCreateModalOpen(false)
      } else {
        alert(`Failed to purchase number: ${JSON.stringify(result.error)}`)
      }
    } catch (error: any) {
      alert(`Failed to purchase number: ${error.message}`)
    }
  }

  const onImportSubmit = async (data: ImportFormInputs) => {
    try {
      const payload: any = {
        phone_number: data.phone_number,
        termination_uri: data.termination_uri,
      }
      if (data.sip_trunk_user_name) payload.sip_trunk_user_name = data.sip_trunk_user_name
      if (data.sip_trunk_password) payload.sip_trunk_password = data.sip_trunk_password
      if (data.inbound_agent_id) payload.inbound_agent_id = data.inbound_agent_id
      if (data.outbound_agent_id) payload.outbound_agent_id = data.outbound_agent_id
      if (data.inbound_agent_version) payload.inbound_agent_version = data.inbound_agent_version
      if (data.outbound_agent_version) payload.outbound_agent_version = data.outbound_agent_version
      if (data.nickname) payload.nickname = data.nickname
      if (data.inbound_webhook_url) payload.inbound_webhook_url = data.inbound_webhook_url

      const result = await importMutation.mutateAsync(payload)
      if (result.success) {
        importForm.reset()
        setCreateModalOpen(false)
        if (result.sip_inbound_uri) {
          alert(`Number imported successfully!\n\nSIP Inbound URI for Zadarma:\n${result.sip_inbound_uri}`)
        }
      } else {
        alert(`Failed to import number: ${JSON.stringify(result.error)}`)
      }
    } catch (error: any) {
      alert(`Failed to import number: ${error.message}`)
    }
  }

  const handleDelete = async (e164: string) => {
    if (confirm(`Are you sure you want to delete ${e164}?`)) {
      try {
        await deleteMutation.mutateAsync(e164)
      } catch (error: any) {
        alert(`Failed to delete number: ${error.message}`)
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Phone Numbers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Purchase numbers from RetellAI or import existing numbers via SIP
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add Number
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
              Add Number
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
                    onClick={() => handleDelete(number.e164)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
            <DialogDescription>
              Purchase a new number from RetellAI or import an existing number via SIP trunking
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="flex gap-2 mb-4 border-b">
              <button
                type="button"
                onClick={() => setActiveTab('purchase')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'purchase'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShoppingCart className="inline mr-2 h-4 w-4" />
                Purchase
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'import'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload className="inline mr-2 h-4 w-4" />
                Import via SIP
              </button>
            </div>
          {activeTab === 'purchase' && (
              <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_phone_number">Phone Number (E.164, optional)</Label>
                    <Input
                      id="purchase_phone_number"
                      {...purchaseForm.register('phone_number')}
                      placeholder="+14157774444"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Or use area_code below</p>
                  </div>
                  <div>
                    <Label htmlFor="purchase_area_code">Area Code (US/CA, optional)</Label>
                    <Input
                      id="purchase_area_code"
                      type="number"
                      {...purchaseForm.register('area_code', { valueAsNumber: true })}
                      placeholder="415"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_country_code">Country Code</Label>
                    <select
                      id="purchase_country_code"
                      {...purchaseForm.register('country_code')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select country...</option>
                      <option value="US">US</option>
                      <option value="CA">CA</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="purchase_number_provider">Provider</Label>
                    <select
                      id="purchase_number_provider"
                      {...purchaseForm.register('number_provider')}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select provider...</option>
                      <option value="twilio">Twilio</option>
                      <option value="telnyx">Telnyx</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_inbound_agent_id">Inbound Agent ID</Label>
                    <Input
                      id="purchase_inbound_agent_id"
                      {...purchaseForm.register('inbound_agent_id')}
                      placeholder="agent_xxx"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_outbound_agent_id">Outbound Agent ID</Label>
                    <Input
                      id="purchase_outbound_agent_id"
                      {...purchaseForm.register('outbound_agent_id')}
                      placeholder="agent_xxx"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_inbound_agent_version">Inbound Agent Version</Label>
                    <Input
                      id="purchase_inbound_agent_version"
                      type="number"
                      {...purchaseForm.register('inbound_agent_version', { valueAsNumber: true })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchase_outbound_agent_version">Outbound Agent Version</Label>
                    <Input
                      id="purchase_outbound_agent_version"
                      type="number"
                      {...purchaseForm.register('outbound_agent_version', { valueAsNumber: true })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="purchase_nickname">Nickname</Label>
                  <Input
                    id="purchase_nickname"
                    {...purchaseForm.register('nickname')}
                    placeholder="My Number"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="purchase_inbound_webhook_url">Inbound Webhook URL</Label>
                  <Input
                    id="purchase_inbound_webhook_url"
                    {...purchaseForm.register('inbound_webhook_url')}
                    placeholder="https://example.com/webhook"
                    className="mt-1.5"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="purchase_toll_free"
                    {...purchaseForm.register('toll_free')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="purchase_toll_free" className="cursor-pointer">Toll-free number</Label>
                </div>
                {purchaseForm.formState.errors.phone_number && (
                  <p className="text-sm text-destructive">{purchaseForm.formState.errors.phone_number.message}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={purchaseMutation.isPending}>
                    {purchaseMutation.isPending ? 'Purchasing...' : 'Purchase'}
                  </Button>
                </div>
              </form>
          )}

          {activeTab === 'import' && (
              <form onSubmit={importForm.handleSubmit(onImportSubmit)} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="import_phone_number">Phone Number (E.164) *</Label>
                  <Input
                    id="import_phone_number"
                    {...importForm.register('phone_number')}
                    placeholder="+390289744903"
                    className="mt-1.5"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="import_termination_uri">Termination URI *</Label>
                  <Input
                    id="import_termination_uri"
                    {...importForm.register('termination_uri')}
                    placeholder="pbx.zadarma.com"
                    className="mt-1.5"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">e.g., pbx.zadarma.com</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="import_sip_trunk_user_name">SIP Trunk User Name</Label>
                    <Input
                      id="import_sip_trunk_user_name"
                      {...importForm.register('sip_trunk_user_name')}
                      placeholder="927458"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="import_sip_trunk_password">SIP Trunk Password</Label>
                    <Input
                      id="import_sip_trunk_password"
                      type="password"
                      {...importForm.register('sip_trunk_password')}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="import_inbound_agent_id">Inbound Agent ID</Label>
                    <Input
                      id="import_inbound_agent_id"
                      {...importForm.register('inbound_agent_id')}
                      placeholder="agent_xxx"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="import_outbound_agent_id">Outbound Agent ID</Label>
                    <Input
                      id="import_outbound_agent_id"
                      {...importForm.register('outbound_agent_id')}
                      placeholder="agent_xxx"
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="import_inbound_agent_version">Inbound Agent Version</Label>
                    <Input
                      id="import_inbound_agent_version"
                      type="number"
                      {...importForm.register('inbound_agent_version', { valueAsNumber: true })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="import_outbound_agent_version">Outbound Agent Version</Label>
                    <Input
                      id="import_outbound_agent_version"
                      type="number"
                      {...importForm.register('outbound_agent_version', { valueAsNumber: true })}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="import_nickname">Nickname</Label>
                  <Input
                    id="import_nickname"
                    {...importForm.register('nickname')}
                    placeholder="Zadarma Milan"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="import_inbound_webhook_url">Inbound Webhook URL</Label>
                  <Input
                    id="import_inbound_webhook_url"
                    {...importForm.register('inbound_webhook_url')}
                    placeholder="https://example.com/webhook"
                    className="mt-1.5"
                  />
                </div>
                {importForm.formState.errors.phone_number && (
                  <p className="text-sm text-destructive">{importForm.formState.errors.phone_number.message}</p>
                )}
                {importForm.formState.errors.termination_uri && (
                  <p className="text-sm text-destructive">{importForm.formState.errors.termination_uri.message}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={importMutation.isPending}>
                    {importMutation.isPending ? 'Importing...' : 'Import'}
                  </Button>
                </div>
              </form>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

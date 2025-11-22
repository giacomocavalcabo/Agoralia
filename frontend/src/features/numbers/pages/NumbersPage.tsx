import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { useNumbers, usePurchasePhoneNumber, useImportPhoneNumber, useDeletePhoneNumber, usePhoneNumberDetails, useUpdatePhoneNumber } from '../hooks'
import { useAgents } from '@/features/agents/hooks'
import { Plus, Trash2, Phone, CheckCircle2, XCircle, Globe, ShoppingCart, Upload, Edit } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

// Purchase schema
const purchaseSchema = z.object({
  area_code: z.number().min(200, 'Area code must be between 200 and 999').max(999, 'Area code must be between 200 and 999'),
  country_code: z.string().min(1, 'Country code is required'),
  number_provider: z.string().optional().default('twilio'),
  inbound_agent_id: z.string().min(1, 'Inbound agent is required'),
  outbound_agent_id: z.string().min(1, 'Outbound agent is required'),
  nickname: z.string().optional(),
  inbound_webhook_url: z.string().url().optional().or(z.literal('')),
  toll_free: z.boolean().optional(),
})

// Import schema
const importSchema = z.object({
  phone_number: z.string().min(1, 'Phone number is required'),
  termination_uri: z.string().min(1, 'Termination URI is required'),
  outbound_transport: z.enum(['TCP', 'UDP', 'TLS']).optional().default('TCP'),
  sip_trunk_auth_username: z.string().optional(),
  sip_trunk_auth_password: z.string().optional(),
  inbound_agent_id: z.string().min(1, 'Inbound agent is required'),
  outbound_agent_id: z.string().min(1, 'Outbound agent is required'),
  nickname: z.string().optional(),
  inbound_webhook_url: z.string().url().optional().or(z.literal('')),
  // Legacy fields (for backward compatibility)
  sip_trunk_user_name: z.string().optional(),
  sip_trunk_password: z.string().optional(),
})

type PurchaseFormInputs = z.infer<typeof purchaseSchema>
type ImportFormInputs = z.infer<typeof importSchema>

// Edit schema
const editSchema = z.object({
  inbound_agent_id: z.string().min(1, 'Inbound agent is required'),
  outbound_agent_id: z.string().min(1, 'Outbound agent is required'),
  nickname: z.string().nullable().optional(),
  inbound_webhook_url: z.string().url().nullable().optional().or(z.literal('')),
})

type EditFormInputs = z.infer<typeof editSchema>

export function NumbersPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingPhoneNumber, setEditingPhoneNumber] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'purchase' | 'import'>('purchase')
  const { data: numbers, isLoading, error } = useNumbers()
  const purchaseMutation = usePurchasePhoneNumber()
  const importMutation = useImportPhoneNumber()
  const deleteMutation = useDeletePhoneNumber()
  const updateMutation = useUpdatePhoneNumber()
  const { data: agents } = useAgents()
  const { data: phoneDetails, isLoading: detailsLoading } = usePhoneNumberDetails(editingPhoneNumber)

  const purchaseForm = useForm<PurchaseFormInputs>({
    resolver: zodResolver(purchaseSchema),
    // No default values - user must select explicitly
  })

  const importForm = useForm<ImportFormInputs>({
    resolver: zodResolver(importSchema),
    // No default values - user must provide explicitly
  })

  const editForm = useForm<EditFormInputs>({
    resolver: zodResolver(editSchema),
  })

  // Load phone details when modal opens
  useEffect(() => {
    if (editModalOpen && editingPhoneNumber && phoneDetails) {
      editForm.reset({
        // For select HTML elements, use empty string instead of null when no agent is associated
        inbound_agent_id: phoneDetails.inbound_agent_id || '',
        outbound_agent_id: phoneDetails.outbound_agent_id || '',
        nickname: phoneDetails.nickname || '',
        inbound_webhook_url: phoneDetails.inbound_webhook_url || '',
      })
    }
  }, [editModalOpen, editingPhoneNumber, phoneDetails, editForm])

  const handleEdit = (phoneNumber: string) => {
    setEditingPhoneNumber(phoneNumber)
    setEditModalOpen(true)
  }

  const onEditSubmit = async (data: EditFormInputs) => {
    if (!editingPhoneNumber) return

    try {
      const payload: any = {}
      // Agent IDs are now required - always send them
      if (data.inbound_agent_id) {
        payload.inbound_agent_id = data.inbound_agent_id.trim()
      }
      if (data.outbound_agent_id) {
        payload.outbound_agent_id = data.outbound_agent_id.trim()
      }
      // Only include version if provided
      if (data.nickname !== undefined) {
        payload.nickname = data.nickname && data.nickname.trim() ? data.nickname.trim() : null
      }
      if (data.inbound_webhook_url !== undefined) {
        payload.inbound_webhook_url = data.inbound_webhook_url && data.inbound_webhook_url.trim() ? data.inbound_webhook_url.trim() : null
      }

      await updateMutation.mutateAsync({ phoneNumber: editingPhoneNumber, payload })
      setEditModalOpen(false)
      setEditingPhoneNumber(null)
      editForm.reset()
    } catch (error: any) {
      alert(`Failed to update number: ${error.message}`)
    }
  }

  const onPurchaseSubmit = async (data: PurchaseFormInputs) => {
    try {
      const payload: any = {}
      if (data.phone_number) payload.phone_number = data.phone_number
      if (data.area_code) payload.area_code = data.area_code
      if (data.country_code) payload.country_code = data.country_code
      if (data.number_provider) payload.number_provider = data.number_provider
      if (data.inbound_agent_id) payload.inbound_agent_id = data.inbound_agent_id
      if (data.outbound_agent_id) payload.outbound_agent_id = data.outbound_agent_id
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
      // Use correct field names as per RetellAI OpenAPI documentation
      if (data.sip_trunk_auth_username) payload.sip_trunk_auth_username = data.sip_trunk_auth_username
      if (data.sip_trunk_auth_password) payload.sip_trunk_auth_password = data.sip_trunk_auth_password
      // Backward compatibility with old field names
      if (data.sip_trunk_user_name && !data.sip_trunk_auth_username) payload.sip_trunk_auth_username = data.sip_trunk_user_name
      if (data.sip_trunk_password && !data.sip_trunk_auth_password) payload.sip_trunk_auth_password = data.sip_trunk_password
      // Note: outbound_transport is NOT in RetellAI OpenAPI documentation
      // Do not send it - only send documented fields
      if (data.inbound_agent_id) payload.inbound_agent_id = data.inbound_agent_id
      if (data.outbound_agent_id) payload.outbound_agent_id = data.outbound_agent_id
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
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(number.e164)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(number.e164)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                    <Label htmlFor="purchase_area_code">Area Code (US/CA) *</Label>
                    <Input
                      id="purchase_area_code"
                      type="number"
                      {...purchaseForm.register('area_code', { 
                        required: 'Area code is required',
                        valueAsNumber: true,
                        min: { value: 200, message: 'Area code must be between 200 and 999' },
                        max: { value: 999, message: 'Area code must be between 200 and 999' },
                      })}
                      placeholder="415"
                      className="mt-1.5"
                    />
                    {purchaseForm.formState.errors.area_code && (
                      <p className="mt-1 text-sm text-destructive">
                        {purchaseForm.formState.errors.area_code.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      RetellAI will automatically find an available number in this area code
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="purchase_country_code">Country Code *</Label>
                    <select
                      id="purchase_country_code"
                      {...purchaseForm.register('country_code', { required: 'Country code is required' })}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select country...</option>
                      <option value="US">US</option>
                      <option value="CA">CA</option>
                    </select>
                    {purchaseForm.formState.errors.country_code && (
                      <p className="mt-1 text-sm text-destructive">
                        {purchaseForm.formState.errors.country_code.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-3 border border-blue-200 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> When you purchase, RetellAI will automatically find and assign an available phone number in the selected area code. You don't need to specify the exact number.
                  </p>
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
                {(!agents || agents.filter((agent) => agent.retell_agent_id).length === 0) ? (
                  <div className="col-span-2 p-4 border border-amber-200 bg-amber-50 rounded-md">
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      No agents available
                    </p>
                    <p className="text-sm text-amber-700">
                      You need to create at least one agent before adding a phone number. 
                      Go to the <strong>Agents</strong> section and create an agent first, then come back to add a phone number.
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchase_inbound_agent_id">Inbound Call Agent *</Label>
                    <select
                      id="purchase_inbound_agent_id"
                      {...purchaseForm.register('inbound_agent_id', { required: 'Inbound agent is required' })}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select an agent...</option>
                      {agents && agents
                        .filter((agent) => agent.retell_agent_id)
                        .map((agent) => (
                          <option key={agent.id} value={agent.retell_agent_id || ''}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                    {purchaseForm.formState.errors.inbound_agent_id && (
                      <p className="mt-1 text-sm text-destructive">
                        {purchaseForm.formState.errors.inbound_agent_id.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent to use for inbound calls. Required for inbound functionality.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="purchase_outbound_agent_id">Outbound Call Agent *</Label>
                    <select
                      id="purchase_outbound_agent_id"
                      {...purchaseForm.register('outbound_agent_id', { required: 'Outbound agent is required' })}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select an agent...</option>
                      {agents && agents
                        .filter((agent) => agent.retell_agent_id)
                        .map((agent) => (
                          <option key={agent.id} value={agent.retell_agent_id || ''}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                    {purchaseForm.formState.errors.outbound_agent_id && (
                      <p className="mt-1 text-sm text-destructive">
                        {purchaseForm.formState.errors.outbound_agent_id.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent to use for outbound calls. Required for outbound functionality.
                    </p>
                  </div>
                </div>
                )}
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
                <div>
                  <Label htmlFor="import_outbound_transport">Outbound Transport</Label>
                  <select
                    id="import_outbound_transport"
                    {...importForm.register('outbound_transport', { required: false })}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue="TCP"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="TLS">TLS</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transport protocol for outbound calls. Default is TCP. (Note: Not in OpenAPI but may be needed)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="import_sip_trunk_auth_username">SIP Trunk Auth Username</Label>
                    <Input
                      id="import_sip_trunk_auth_username"
                      {...importForm.register('sip_trunk_auth_username')}
                      placeholder="username"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Username for SIP trunk authentication (optional)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="import_sip_trunk_auth_password">SIP Trunk Auth Password</Label>
                    <Input
                      id="import_sip_trunk_auth_password"
                      type="password"
                      {...importForm.register('sip_trunk_auth_password')}
                      placeholder="password"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Password for SIP trunk authentication (optional)
                    </p>
                  </div>
                </div>
                {(!agents || agents.filter((agent) => agent.retell_agent_id).length === 0) ? (
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-md">
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      No agents available
                    </p>
                    <p className="text-sm text-amber-700">
                      You need to create at least one agent before adding a phone number. 
                      Go to the <strong>Agents</strong> section and create an agent first, then come back to add a phone number.
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="import_inbound_agent_id">Inbound Call Agent *</Label>
                    <select
                      id="import_inbound_agent_id"
                      {...importForm.register('inbound_agent_id', { required: 'Inbound agent is required' })}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select an agent...</option>
                      {agents && agents
                        .filter((agent) => agent.retell_agent_id)
                        .map((agent) => (
                          <option key={agent.id} value={agent.retell_agent_id || ''}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                    {importForm.formState.errors.inbound_agent_id && (
                      <p className="mt-1 text-sm text-destructive">
                        {importForm.formState.errors.inbound_agent_id.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent to use for inbound calls. Required for inbound functionality.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="import_outbound_agent_id">Outbound Call Agent *</Label>
                    <select
                      id="import_outbound_agent_id"
                      {...importForm.register('outbound_agent_id', { required: 'Outbound agent is required' })}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select an agent...</option>
                      {agents && agents
                        .filter((agent) => agent.retell_agent_id)
                        .map((agent) => (
                          <option key={agent.id} value={agent.retell_agent_id || ''}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                    {importForm.formState.errors.outbound_agent_id && (
                      <p className="mt-1 text-sm text-destructive">
                        {importForm.formState.errors.outbound_agent_id.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent to use for outbound calls. Required for outbound functionality.
                    </p>
                  </div>
                </div>
                )}
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

      {/* Edit Phone Number Modal */}
      <Dialog open={editModalOpen} onOpenChange={(open) => {
        setEditModalOpen(open)
        if (!open) {
          setEditingPhoneNumber(null)
          editForm.reset()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Phone Number</DialogTitle>
            <DialogDescription>
              Configure agents and settings for {editingPhoneNumber || 'this number'}
            </DialogDescription>
          </DialogHeader>
          {detailsLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading phone number details...</div>
          ) : (
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit_nickname">Nickname (optional)</Label>
                <Input
                  id="edit_nickname"
                  {...editForm.register('nickname')}
                  placeholder="e.g., Zadarma Milan"
                  className="mt-1.5"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_inbound_agent_id">Inbound Call Agent *</Label>
                  <select
                    id="edit_inbound_agent_id"
                    {...editForm.register('inbound_agent_id', { required: 'Inbound agent is required' })}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select an agent...</option>
                    {agents && agents
                      .filter((agent) => agent.retell_agent_id)
                      .map((agent) => (
                        <option key={agent.id} value={agent.retell_agent_id || ''}>
                          {agent.name}
                        </option>
                      ))}
                  </select>
                  {editForm.formState.errors.inbound_agent_id && (
                    <p className="mt-1 text-sm text-destructive">
                      {editForm.formState.errors.inbound_agent_id.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Agent to use for inbound calls. Required for inbound functionality.
                  </p>
                </div>
                <div>
                  <Label htmlFor="edit_outbound_agent_id">Outbound Call Agent *</Label>
                  <select
                    id="edit_outbound_agent_id"
                    {...editForm.register('outbound_agent_id', { required: 'Outbound agent is required' })}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select an agent...</option>
                    {agents && agents
                      .filter((agent) => agent.retell_agent_id)
                      .map((agent) => (
                        <option key={agent.id} value={agent.retell_agent_id || ''}>
                          {agent.name}
                        </option>
                      ))}
                  </select>
                  {editForm.formState.errors.outbound_agent_id && (
                    <p className="mt-1 text-sm text-destructive">
                      {editForm.formState.errors.outbound_agent_id.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Agent to use for outbound calls. Required for outbound functionality.
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="edit_inbound_webhook_url">Inbound Webhook URL (optional)</Label>
                <Input
                  id="edit_inbound_webhook_url"
                  {...editForm.register('inbound_webhook_url')}
                  placeholder="https://example.com/webhook"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Webhook URL for inbound calls. Leave empty to disable webhook.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setEditModalOpen(false)
                    setEditingPhoneNumber(null)
                    editForm.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

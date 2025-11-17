import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useLeads, useImportLeadsCSV } from '../hooks'
import { Upload, Users, Phone, Building2 } from 'lucide-react'

export function LeadsPage() {
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const { data: leadsData, isLoading, error } = useLeads({ limit: 50 })
  const importMutation = useImportLeadsCSV()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) {
      alert('Please select a CSV file')
      return
    }

    try {
      const result = await importMutation.mutateAsync({ campaignId: null, file })
      alert(`Imported ${result.imported} leads successfully`)
      setFile(null)
      setImportModalOpen(false)
    } catch (error: any) {
      alert(`Failed to import leads: ${error.message}`)
    }
  }

  const leads = leadsData?.items || []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your leads for campaigns
          </p>
        </div>
        <Button onClick={() => setImportModalOpen(true)} size="lg">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading leads...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">Error loading leads: {error.message}</p>
          </CardContent>
        </Card>
      ) : !leads || leads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No leads yet. Import your first CSV file to get started.
            </p>
            <Button onClick={() => setImportModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {leads.length} of {leadsData?.total || 0} leads
            </p>
          </div>
          <div className="space-y-2">
            {leads.map((lead) => (
              <Card key={lead.id} className="transition-colors hover:border-primary/50">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{lead.name}</div>
                        <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{lead.phone}</span>
                          </div>
                          {lead.company && (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{lead.company}</span>
                            </div>
                          )}
                        </div>
                        {lead.nature && (
                          <div className="mt-2">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {lead.nature.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import leads from CSV</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleImport(); }} className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSV file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-1.5"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                CSV format: name, phone, company (optional)
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!file || importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

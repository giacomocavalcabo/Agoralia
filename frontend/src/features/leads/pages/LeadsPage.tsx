import { useState } from 'react'
import { PageHeader } from '@/shared/layout/PageHeader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { useLeads, useImportLeadsCSV } from '../hooks'
import { Upload, Plus } from 'lucide-react'

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
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Manage your leads for campaigns"
        action={
          <Button onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        }
      />

      {isLoading ? (
        <div>Loading leads...</div>
      ) : error ? (
        <div className="text-destructive">Error loading leads: {error.message}</div>
      ) : !leads || leads.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No leads yet. Import your first CSV file to get started.</p>
            <Button onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {leads.length} of {leadsData?.total || 0} leads
          </div>
          <div className="space-y-2">
            {leads.map((lead) => (
              <Card key={lead.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {lead.phone} {lead.company && `• ${lead.company}`}
                      </div>
                      {lead.nature && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {lead.nature.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {importModalOpen && (
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Import Leads from CSV</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground mt-2">
                CSV format: name, phone, company (optional)
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file || importMutation.isPending}>
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


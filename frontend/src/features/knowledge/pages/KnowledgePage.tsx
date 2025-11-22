import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useKnowledgeBases, useCreateKnowledgeBase, useDeleteKnowledgeBase, useKnowledgeBase, useUpdateKnowledgeBase, useAddKbSources, useDeleteKbSource } from '../hooks'
import { Plus, Trash2, BookOpen, Globe, CheckCircle2, XCircle, FileText, Link as LinkIcon, Upload, Copy, Edit, Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import type { KbTextEntry } from '../api'

const kbSchema = z.object({
  name: z.string().min(1, 'Name is required').max(40, 'Name must be less than 40 characters'),
  lang: z.string().optional(),
  scope: z.string().optional().default('general'),
})

type KbFormInputs = z.infer<typeof kbSchema>

export function KnowledgePage() {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [addSourceModalOpen, setAddSourceModalOpen] = useState(false)
  const [selectedKbId, setSelectedKbId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'urls' | 'files' | 'text'>('text')
  const [editActiveTab, setEditActiveTab] = useState<'urls' | 'files' | 'text'>('text')
  
  // Form data for creating KB
  const [kbTexts, setKbTexts] = useState<KbTextEntry[]>([])
  const [kbUrls, setKbUrls] = useState<string[]>([])
  const [kbFiles, setKbFiles] = useState<File[]>([])
  const [enableAutoRefresh, setEnableAutoRefresh] = useState(false)
  
  // Form data for adding sources to existing KB
  const [editKbTexts, setEditKbTexts] = useState<KbTextEntry[]>([])
  const [editKbUrls, setEditKbUrls] = useState<string[]>([])
  const [editKbName, setEditKbName] = useState<string>('')
  
  const { data: kbs, isLoading } = useKnowledgeBases()
  const { data: selectedKb, isLoading: isLoadingKb } = useKnowledgeBase(selectedKbId)
  const createMutation = useCreateKnowledgeBase()
  const updateMutation = useUpdateKnowledgeBase()
  const addSourcesMutation = useAddKbSources()
  const deleteSourceMutation = useDeleteKbSource()
  const deleteMutation = useDeleteKnowledgeBase()
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<KbFormInputs>({
    resolver: zodResolver(kbSchema),
    defaultValues: {
      scope: 'general',
    },
  })

  // Auto-select first KB when list loads
  useEffect(() => {
    if (kbs && kbs.length > 0 && !selectedKbId) {
      setSelectedKbId(kbs[0].id)
    }
  }, [kbs, selectedKbId])

  // Reset create form when modal opens
  useEffect(() => {
    if (createModalOpen) {
      reset({
        name: '',
        lang: undefined,
        scope: 'general',
      })
      setKbTexts([])
      setKbUrls([])
      setKbFiles([])
      setEnableAutoRefresh(false)
      setActiveTab('text')
    }
  }, [createModalOpen, reset])

  // Reset edit form when modal opens
  useEffect(() => {
    if (editModalOpen && selectedKb) {
      setEditKbName(selectedKb.name || '')
    }
  }, [editModalOpen, selectedKb])

  const onSubmit = async (data: KbFormInputs) => {
    try {
      const payload: any = {
        name: data.name,
        lang: data.lang || undefined,
        scope: data.scope || 'general',
      }
      
      // Add texts if any
      if (kbTexts.length > 0) {
        payload.knowledge_base_texts = kbTexts.filter(t => t.title.trim() && t.text.trim())
      }
      
      // Add URLs if any
      if (kbUrls.length > 0) {
        payload.knowledge_base_urls = kbUrls.filter(url => url.trim())
      }
      
      // Add auto-refresh if URLs are provided
      if (kbUrls.length > 0) {
        payload.enable_auto_refresh = enableAutoRefresh
      }
      
      // Create FormData if files are present, otherwise use JSON
      if (kbFiles.length > 0) {
        const formData = new FormData()
        formData.append('name', data.name)
        if (data.lang) formData.append('lang', data.lang)
        if (data.scope) formData.append('scope', data.scope)
        
        // Add texts as JSON string
        if (kbTexts.length > 0) {
          formData.append('knowledge_base_texts', JSON.stringify(kbTexts.filter(t => t.title.trim() && t.text.trim())))
        }
        
        // Add URLs as JSON string
        if (kbUrls.length > 0) {
          formData.append('knowledge_base_urls', JSON.stringify(kbUrls.filter(url => url.trim())))
          formData.append('enable_auto_refresh', enableAutoRefresh ? 'true' : 'false')
        }
        
        // Add files (RetellAI expects array of files)
        kbFiles.forEach((file) => {
          formData.append('knowledge_base_files', file)
        })
        
        await createMutation.mutateAsync(formData as any)
      } else {
        await createMutation.mutateAsync(payload)
      }
      
      reset()
      setKbTexts([])
      setKbUrls([])
      setKbFiles([])
      setEnableAutoRefresh(false)
      setCreateModalOpen(false)
      setActiveTab('text')
    } catch (error: any) {
      alert(`Failed to create knowledge base: ${error.message}`)
    }
  }

  const handleDelete = async (kbId: number) => {
    if (confirm('Are you sure you want to delete this knowledge base?')) {
      try {
        await deleteMutation.mutateAsync(kbId)
        if (selectedKbId === kbId) {
          const remaining = kbs?.filter(kb => kb.id !== kbId) || []
          setSelectedKbId(remaining.length > 0 ? remaining[0].id : null)
        }
      } catch (error: any) {
        alert(`Failed to delete knowledge base: ${error.message}`)
      }
    }
  }

  const addTextEntry = () => {
    setKbTexts([...kbTexts, { title: '', text: '' }])
  }

  const updateTextEntry = (index: number, field: 'title' | 'text', value: string) => {
    const updated = [...kbTexts]
    updated[index] = { ...updated[index], [field]: value }
    setKbTexts(updated)
  }

  const removeTextEntry = (index: number) => {
    setKbTexts(kbTexts.filter((_, i) => i !== index))
  }

  const addUrlEntry = () => {
    setKbUrls([...kbUrls, ''])
  }

  const updateUrlEntry = (index: number, value: string) => {
    const updated = [...kbUrls]
    updated[index] = value
    setKbUrls(updated)
  }

  const removeUrlEntry = (index: number) => {
    setKbUrls(kbUrls.filter((_, i) => i !== index))
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Validate file sizes (50MB max per RetellAI) and limit (25 files)
    if (kbFiles.length + files.length > 25) {
      alert(`Maximum 25 files allowed. You already have ${kbFiles.length} file(s).`)
      return
    }
    const validFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`)
        return false
      }
      return true
    })
    setKbFiles([...kbFiles, ...validFiles])
    // Reset input to allow selecting same file again
    e.target.value = ''
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files || [])
    // Validate file sizes (50MB max per RetellAI) and limit (25 files)
    if (kbFiles.length + files.length > 25) {
      alert(`Maximum 25 files allowed. You already have ${kbFiles.length} file(s).`)
      return
    }
    const validFiles = files.filter(file => {
      if (file.size > 50 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 50MB.`)
        return false
      }
      return true
    })
    setKbFiles([...kbFiles, ...validFiles])
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const removeFile = (index: number) => {
    setKbFiles(kbFiles.filter((_, i) => i !== index))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Could add toast notification here
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 K'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} K`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 border-r bg-background p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
          ) : kbs && kbs.length > 0 ? (
            kbs.map((kb) => (
              <button
                key={kb.id}
                onClick={() => setSelectedKbId(kb.id)}
                className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  selectedKbId === kb.id
                    ? 'bg-muted font-medium'
                    : 'hover:bg-muted/50'
                }`}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">{kb.name || `KB #${kb.id}`}</span>
              </button>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No knowledge bases yet
            </div>
          )}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedKbId && selectedKb ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-semibold">{selectedKb.name || `KB #${selectedKb.id}`}</h1>
                <div className="mt-2 space-y-1">
                  {selectedKb.created_by_user_name && (
                    <p className="text-sm text-muted-foreground">
                      {selectedKb.created_by_user_name}
                    </p>
                  )}
                  {selectedKb.created_at && (
                    <p className="text-sm text-muted-foreground">
                      Uploaded by: {format(new Date(selectedKb.created_at), 'MM/dd/yyyy HH:mm')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(selectedKb.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Badge */}
            {selectedKb.status && (
              <div className="flex items-center gap-2">
                {selectedKb.status === 'complete' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Complete</span>
                  </>
                ) : selectedKb.status === 'error' ? (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">Error</span>
                  </>
                ) : (
                  <>
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">In Progress</span>
                  </>
                )}
              </div>
            )}

            {/* Knowledge Base Sources */}
            {selectedKb.knowledge_base_sources && selectedKb.knowledge_base_sources.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Sources</h2>
                {selectedKb.knowledge_base_sources.map((source, index) => (
                  <Card key={source.source_id || index}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          {source.type === 'document' ? (
                            <div className="h-12 w-12 bg-blue-100 rounded flex items-center justify-center">
                              <FileText className="h-6 w-6 text-blue-600" />
                            </div>
                          ) : source.type === 'url' ? (
                            <div className="h-12 w-12 bg-green-100 rounded flex items-center justify-center">
                              <LinkIcon className="h-6 w-6 text-green-600" />
                            </div>
                          ) : (
                            <div className="h-12 w-12 bg-orange-100 rounded flex items-center justify-center">
                              <span className="text-xs font-semibold text-orange-600">TEXT</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">
                            {source.filename || source.title || source.url || 'Untitled'}
                          </h3>
                          {(source.file_size || source.content_url || source.url) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatFileSize(source.file_size)}
                              {source.url && (
                                <span className="ml-2 truncate block">{source.url}</span>
                              )}
                            </p>
                          )}
                        </div>
                        {source.file_url && (
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No sources yet. Add web pages, files, or text to populate this knowledge base.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">No knowledge base selected</p>
              <p className="text-sm text-muted-foreground mb-4">
                Select a knowledge base from the sidebar or create a new one
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Knowledge Base
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Knowledge Base Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
            <DialogDescription>
              Create a new knowledge base by adding web pages, files, or text content
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="kb_name">Name *</Label>
              <Input
                id="kb_name"
                {...register('name')}
                placeholder="e.g., Company Knowledge Base"
                className="mt-1.5"
                maxLength={40}
                required
              />
              {errors.name && (
                <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Must be less than 40 characters</p>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-4">Add Sources</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add content to your knowledge base by adding text, web pages, or uploading files
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text">Add Text</TabsTrigger>
                <TabsTrigger value="urls">Add Web Pages</TabsTrigger>
                <TabsTrigger value="files">Upload Files</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add articles manually by entering title and text content
                  </p>
                  {kbTexts.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {kbTexts.map((entry, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-sm font-medium">Text Entry {index + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTextEntry(index)}
                                className="h-8 w-8"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label htmlFor={`text_title_${index}`}>Title *</Label>
                                <Input
                                  id={`text_title_${index}`}
                                  value={entry.title}
                                  onChange={(e) => updateTextEntry(index, 'title', e.target.value)}
                                  placeholder="e.g., Company Overview"
                                  className="mt-1.5"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`text_content_${index}`}>Text *</Label>
                                <Textarea
                                  id={`text_content_${index}`}
                                  value={entry.text}
                                  onChange={(e) => updateTextEntry(index, 'text', e.target.value)}
                                  placeholder="Enter the text content here..."
                                  className="mt-1.5 min-h-[100px]"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTextEntry}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Text Entry
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="urls" className="space-y-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Crawl and sync your website. URLs will be scraped and added to the knowledge base.
                  </p>
                  {kbUrls.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {kbUrls.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={url}
                            onChange={(e) => updateUrlEntry(index, e.target.value)}
                            placeholder="https://example.com"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeUrlEntry(index)}
                            className="h-10 w-10"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addUrlEntry}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Web Page URL
                  </Button>
                  {kbUrls.length > 0 && (
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="auto_refresh"
                        checked={enableAutoRefresh}
                        onChange={(e) => setEnableAutoRefresh(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <Label htmlFor="auto_refresh" className="cursor-pointer text-sm">
                        Enable auto-refresh (retrieve data from URLs every 12 hours)
                      </Label>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="files" className="space-y-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload files to add to the knowledge base. Maximum 25 files, 50MB per file.
                  </p>
                  
                  {kbFiles.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {kbFiles.map((file, index) => (
                        <Card key={index}>
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              className="h-8 w-8 flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  <div
                    className="border-2 border-dashed border-input rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onDrop={handleFileDrop}
                    onDragOver={handleDragOver}
                  >
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop files here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Supported formats: PDF, DOC, DOCX, TXT, MD (max 25 files, 50MB each)
                    </p>
                    <input
                      type="file"
                      id="file-upload"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.md"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={kbFiles.length >= 25}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {kbFiles.length >= 25 ? 'Maximum 25 files' : 'Select Files'}
                    </Button>
                    {kbFiles.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {kbFiles.length} file{kbFiles.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Knowledge Base'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Knowledge Base Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Knowledge Base</DialogTitle>
          </DialogHeader>
          {selectedKb && (
            <div className="space-y-6 mt-4">
              {/* Knowledge Base Name */}
              <div>
                <Label htmlFor="edit_kb_name">Knowledge Base Name</Label>
                <Input
                  id="edit_kb_name"
                  value={editKbName || selectedKb.name || ''}
                  placeholder="e.g., it-IT-KB-4"
                  className="mt-1.5"
                  maxLength={40}
                  onChange={(e) => setEditKbName(e.target.value)}
                />
              </div>

              {/* Documents List */}
              <div>
                <Label className="mb-3 block">Documents</Label>
                {selectedKb.knowledge_base_sources && selectedKb.knowledge_base_sources.length > 0 ? (
                  <div className="space-y-3">
                    {selectedKb.knowledge_base_sources.map((source, index) => (
                      <Card key={source.source_id || index} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="relative flex-shrink-0">
                              {source.type === 'document' ? (
                                <div className="h-10 w-10 bg-blue-100 rounded flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                              ) : source.type === 'url' ? (
                                <div className="h-10 w-10 bg-green-100 rounded flex items-center justify-center">
                                  <LinkIcon className="h-5 w-5 text-green-600" />
                                </div>
                              ) : (
                                <div className="h-10 w-10 bg-orange-100 rounded flex items-center justify-center">
                                  <span className="text-xs font-semibold text-orange-600">TEXT</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                {source.type === 'text' && source.title
                                  ? `${source.title}: ${source.title}`
                                  : source.filename || source.title || source.url || 'Untitled'}
                              </p>
                              {source.type === 'text' && source.content_url && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {source.content_url}
                                </p>
                              )}
                              {source.type === 'text' && !source.title && !source.content_url && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatFileSize(source.file_size)}
                                </p>
                              )}
                            </div>
                            {source.source_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this document?')) {
                                    try {
                                      await deleteSourceMutation.mutateAsync({
                                        kbId: selectedKb.id,
                                        sourceId: source.source_id!,
                                      })
                                    } catch (error: any) {
                                      alert(`Failed to delete document: ${error.message}`)
                                    }
                                  }
                                }}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                disabled={deleteSourceMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    No documents yet. Click "Add" to add documents.
                  </p>
                )}
                
                {/* Add Button - Opens Add Sources Dialog */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditKbTexts([])
                    setEditKbUrls([])
                    setEditActiveTab('text')
                    setAddSourceModalOpen(true)
                  }}
                  className="mt-3"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const newName = editKbName.trim() || selectedKb.name
                    
                    if (newName && newName !== selectedKb.name) {
                      try {
                        await updateMutation.mutateAsync({
                          kbId: selectedKb.id,
                          payload: { name: newName },
                        })
                      } catch (error: any) {
                        alert(`Failed to update knowledge base: ${error.message}`)
                        return
                      }
                    }
                    
                    setEditModalOpen(false)
                    setEditKbName('')
                  }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

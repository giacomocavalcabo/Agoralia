import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SaveIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { api } from '../lib/api'
import { Card } from './ui/Card'
import { Button } from './ui/button'
import { ProgressBar } from './ui/ProgressBar'
import { Badge } from './ui/Badge'

export function KBEditor({ kbId, onSave }) {
  const [editingSection, setEditingSection] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const queryClient = useQueryClient()
  
  // Fetch KB data
  const { data: kb, isLoading } = useQuery({
    queryKey: ['kb', kbId],
    queryFn: () => api.get(`/kb/${kbId}`),
    enabled: !!kbId
  })
  
  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: (data) => api.patch(`/kb/sections/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb', kbId])
      setEditingSection(null)
    }
  })
  
  // Update field mutation
  const updateFieldMutation = useMutation({
    mutationFn: (data) => api.patch(`/kb/fields/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb', kbId])
      setEditingField(null)
    }
  })
  
  const handleSectionEdit = (section) => {
    setEditingSection({ ...section })
  }
  
  const handleSectionSave = async () => {
    if (editingSection) {
      await updateSectionMutation.mutateAsync(editingSection)
    }
  }
  
  const handleFieldEdit = (field) => {
    setEditingField({ ...field })
  }
  
  const handleFieldSave = async () => {
    if (editingField) {
      await updateFieldMutation.mutateAsync(editingField)
    }
  }
  
  const calculateSectionCompleteness = (section) => {
    const fields = kb?.fields?.filter(f => f.section_id === section.id) || []
    if (fields.length === 0) return 0
    
    const completedFields = fields.filter(f => f.value_text || f.value_json).length
    return Math.round((completedFields / fields.length) * 100)
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!kb) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Knowledge base not found</div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* KB Header */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{kb.name}</h1>
              <p className="text-gray-600">{kb.kind} • {kb.type}</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeSlashIcon className="h-4 w-4 mr-2" /> : <EyeIcon className="h-4 w-4 mr-2" />}
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <SaveIcon className="h-4 w-4 mr-2" />
                Save All
              </Button>
            </div>
          </div>
          
          {/* Overall Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Completeness</span>
                <span>{kb.completeness_pct}%</span>
              </div>
              <ProgressBar value={kb.completeness_pct} color="blue" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Freshness</span>
                <span>{kb.freshness_score}/100</span>
              </div>
              <ProgressBar 
                value={kb.freshness_score} 
                color={kb.freshness_score >= 80 ? 'green' : kb.freshness_score >= 60 ? 'yellow' : 'red'} 
              />
            </div>
          </div>
        </div>
      </Card>
      
      {/* Sections */}
      <div className="space-y-4">
        {kb.sections?.map((section) => (
          <Card key={section.id}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-500">Key: {section.key}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant="secondary">
                    {calculateSectionCompleteness(section)}% complete
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSectionEdit(section)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              
              {/* Section Content */}
              {editingSection?.id === section.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editingSection.title}
                      onChange={(e) => setEditingSection({
                        ...editingSection,
                        title: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content (Markdown)
                    </label>
                    <textarea
                      value={editingSection.content_md || ''}
                      onChange={(e) => setEditingSection({
                        ...editingSection,
                        content_md: e.target.value
                      })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleSectionSave}
                      disabled={updateSectionMutation.isLoading}
                    >
                      Save Section
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingSection(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose max-w-none">
                  {section.content_md ? (
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {section.content_md}
                    </div>
                  ) : (
                    <div className="text-gray-400 italic">No content yet</div>
                  )}
                </div>
              )}
              
              {/* Section Fields */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Fields</h4>
                <div className="space-y-3">
                  {kb.fields
                    ?.filter(field => field.section_id === section.id)
                    ?.map((field) => (
                      <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{field.label}</div>
                          <div className="text-xs text-gray-500">Key: {field.key}</div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant={field.lang === 'en-US' ? 'default' : 'secondary'}>
                            {field.lang}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleFieldEdit(field)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Field Editor Modal */}
      {editingField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Field</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label
                </label>
                <input
                  type="text"
                  value={editingField.label}
                  onChange={(e) => setEditingField({
                    ...editingField,
                    label: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value
                </label>
                <textarea
                  value={editingField.value_text || ''}
                  onChange={(e) => setEditingField({
                    ...editingField,
                    value_text: e.target.value
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={handleFieldSave}
                  disabled={updateFieldMutation.isLoading}
                >
                  Save Field
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingField(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

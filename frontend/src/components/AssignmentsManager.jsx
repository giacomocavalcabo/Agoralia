import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, TrashIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../lib/api'
import { Card } from './ui/Card'
import { Button } from './ui/button'
import { Badge } from './ui/Badge'
import ConfirmDialog from './ConfirmDialog'

export function AssignmentsManager() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    scope: 'workspace_default',
    scope_id: '',
    kb_id: ''
  })
  const queryClient = useQueryClient()
  
  // Fetch assignments
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['kb-assignments'],
    queryFn: () => api.get('/kb/assignments')
  })
  
  // Fetch KBs for dropdown
  const { data: kbs } = useQuery({
    queryKey: ['kb-list'],
    queryFn: () => api.get('/kb')
  })
  
  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: (data) => api.post('/kb/assign', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-assignments'])
      setShowCreateForm(false)
      setNewAssignment({ scope: 'workspace_default', scope_id: '', kb_id: '' })
    }
  })
  
  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: (id) => api.delete(`/kb/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['kb-assignments'])
    }
  })
  
  const handleCreateAssignment = async () => {
    if (!newAssignment.kb_id) return
    
    await createAssignmentMutation.mutateAsync(newAssignment)
  }
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const handleDeleteAssignment = async (id) => {
    await deleteAssignmentMutation.mutateAsync(id)
  }
  
  const scopeOptions = [
    { value: 'workspace_default', label: 'Workspace Default', description: 'Default KB for entire workspace' },
    { value: 'campaign', label: 'Campaign', description: 'Specific campaign KB' },
    { value: 'number', label: 'Phone Number', description: 'KB for specific phone number' },
    { value: 'agent', label: 'Agent', description: 'KB for specific agent' }
  ]
  
  const precedenceOrder = ['campaign', 'number', 'agent', 'workspace_default']
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">KB Assignments</h2>
          <p className="text-gray-600">Manage knowledge base assignments and precedence</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </div>
      
      {/* Precedence Info */}
      <Card>
        <div className="p-6">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="h-6 w-6 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Assignment Precedence</h3>
              <p className="text-gray-600 mb-4">
                When multiple KBs are assigned, the system uses this precedence order:
              </p>
              <div className="space-y-2">
                {precedenceOrder.map((scope, index) => (
                  <div key={scope} className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <span className="font-medium capitalize">{scope.replace('_', ' ')}</span>
                      <span className="text-gray-500 ml-2">
                        {scope === 'workspace_default' ? '(fallback)' : '(highest priority)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Create Assignment Form */}
      {showCreateForm && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scope Type
                </label>
                <select
                  value={newAssignment.scope}
                  onChange={(e) => setNewAssignment({
                    ...newAssignment,
                    scope: e.target.value,
                    scope_id: ''
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {scopeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {newAssignment.scope !== 'workspace_default' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scope ID
                  </label>
                  <input
                    type="text"
                    value={newAssignment.scope_id}
                    onChange={(e) => setNewAssignment({
                      ...newAssignment,
                      scope_id: e.target.value
                    })}
                    placeholder={`Enter ${newAssignment.scope} ID`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Knowledge Base
                </label>
                <select
                  value={newAssignment.kb_id}
                  onChange={(e) => setNewAssignment({
                    ...newAssignment,
                    kb_id: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select KB</option>
                  {kbs?.results?.map(kb => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name} ({kb.kind})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex space-x-3">
              <Button
                onClick={handleCreateAssignment}
                disabled={!newAssignment.kb_id || createAssignmentMutation.isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create Assignment
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      {/* Assignments List */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Assignments</h3>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : assignments?.assignments?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No assignments found. Create your first assignment above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Knowledge Base
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments?.assignments?.map((assignment) => {
                    const priority = precedenceOrder.indexOf(assignment.scope) + 1
                    return (
                      <tr key={assignment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary" className="capitalize">
                              {assignment.scope.replace('_', ' ')}
                            </Badge>
                            {assignment.scope_id && (
                              <span className="text-sm text-gray-500">
                                {assignment.scope_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.kb_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {assignment.kb_kind} • {assignment.kb_status}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                              {priority}
                            </div>
                            <span className="text-sm text-gray-500">
                              {priority === 1 ? 'Highest' : priority === precedenceOrder.length ? 'Fallback' : `${priority}${priority === 2 ? 'nd' : priority === 3 ? 'rd' : 'th'}`}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(assignment.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        title="Delete Assignment"
        body="Are you sure you want to delete this assignment? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          handleDeleteAssignment(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

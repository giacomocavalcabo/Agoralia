import { useState } from 'react'
import ResourceSelector from './ResourceSelector'
import CreateResourceModal from './CreateResourceModal'

export default function ResourceSelectorInline({
  type,
  value,
  onChange,
  options = [],
  filter,
  label,
  placeholder,
  disabled = false,
  error,
  onCreate
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  function handleCreate(newResource) {
    // Refresh options (parent should reload)
    onCreate?.(newResource)
    // Auto-select nuovo resource
    if (newResource?.id || newResource?.retell_agent_id) {
      const newValue = type === 'agent' 
        ? (newResource.retell_agent_id || newResource.id)
        : (newResource.id)
      onChange?.(newValue)
    }
    setShowCreateModal(false)
  }
  
  return (
    <>
      <ResourceSelector
        type={type}
        value={value}
        onChange={onChange}
        options={options}
        filter={filter}
        showCreate={true}
        onCreateClick={() => setShowCreateModal(true)}
        label={label}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
      />
      
      <CreateResourceModal
        type={type}
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </>
  )
}


import React from 'react'
import { Button } from './button'

export function ConfirmDialog({ 
  isOpen, 
  title, 
  description, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  confirmVariant = 'default',
  onConfirm, 
  onCancel 
}) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="confirm-dialog">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}

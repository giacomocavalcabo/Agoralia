import React from 'react'
import { cn } from '../../lib/utils'

// Form Row - Wrapper for form field groups
export function FormRow({ children, className, ...props }) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  )
}

// Field Label - Accessible label for form fields
export function FieldLabel({ htmlFor, children, required, className, ...props }) {
  return (
    <label 
      htmlFor={htmlFor} 
      className={cn(
        "block text-sm font-medium text-gray-700 mb-2",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

// Field Help - Help text below form fields
export function FieldHelp({ children, className, ...props }) {
  return (
    <p className={cn("text-sm text-gray-500 mt-1", className)} {...props}>
      {children}
    </p>
  )
}

// Field Error - Error message display
export function FieldError({ children, className, ...props }) {
  if (!children) return null
  
  return (
    <p className={cn("text-sm text-red-600 mt-1", className)} {...props}>
      {children}
    </p>
  )
}

// Form Actions - Sticky form action buttons
export function FormActions({ children, className, ...props }) {
  return (
    <div className={cn("flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200", className)} {...props}>
      {children}
    </div>
  )
}

// Page Header - Consistent page header with title and description
export function PageHeader({ title, description, children, className, ...props }) {
  return (
    <div className={cn("mb-8", className)} {...props}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {title}
          </h1>
          {description && (
            <p className="text-gray-600 mt-1">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center space-x-3">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

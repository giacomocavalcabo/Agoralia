import React from 'react'

export function ProgressBar({ 
  value, 
  max = 100, 
  color = 'blue', 
  size = 'md',
  showLabel = true,
  className = ''
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-primary-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    gray: 'bg-gray-600'
  }
  
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }
  
  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-gray-600">
          {value}% complete
        </div>
      )}
    </div>
  )
}

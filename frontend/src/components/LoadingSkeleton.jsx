import React from 'react'

export function LoadingSkeleton({ className = "", rows = 3, height = "h-4" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} bg-gray-200 rounded animate-pulse`}></div>
      ))}
    </div>
  )
}

export function CardSkeleton({ className = "" }) {
  return (
    <div className={`p-6 border rounded-lg space-y-4 ${className}`}>
      <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function KBEditorSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-64"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 bg-gray-200 rounded animate-pulse w-20"></div>
          <div className="h-9 bg-gray-200 rounded animate-pulse w-24"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex space-x-4 border-b">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-8 bg-gray-200 rounded animate-pulse w-20"></div>
              ))}
            </div>

            {/* Content */}
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  )
}

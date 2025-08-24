import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  BarElement,
  ArcElement
} from 'chart.js'

// Register Chart.js plugins globally
ChartJS.register(
  LineElement, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  Tooltip, 
  Legend, 
  Filler,
  BarElement,
  ArcElement
)

/**
 * Unified ChartCard wrapper for consistent chart styling across the app
 * Follows the UI Polish playbook: rounded-xl, shadow-sm, proper spacing
 */
export default function ChartCard({ 
  title, 
  subtitle,
  action,
  children, 
  isEmpty = false,
  isLoading = false,
  emptyMessage,
  className = '',
  headerClassName = '',
  contentClassName = ''
}) {
  const { t } = useTranslation('common')

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm p-4 md:p-6 ${className}`}>
      {/* Header */}
      {(title || subtitle || action) && (
        <div className={`flex items-center justify-between mb-4 ${headerClassName}`}>
          <div className="flex-1">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
            )}
          </div>
          {action && (
            <div className="flex-shrink-0 ml-4">
              {action}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className={`${contentClassName}`}>
        {isLoading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyChart message={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </div>
  )
}

/**
 * Empty state for charts
 */
export function EmptyChart({ message, icon = "📊" }) {
  const { t } = useTranslation('common')
  
  return (
    <div className="h-40 flex flex-col items-center justify-center text-gray-500">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm text-center">
        {message || t('empty')}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for charts
 */
export function ChartSkeleton({ height = 160 }) {
  return (
    <div 
      className="animate-pulse bg-gray-100 rounded-lg"
      style={{ height: `${height}px` }}
    >
      <div className="flex items-end justify-between h-full p-4">
        {/* Simulate chart bars */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-200 rounded-sm"
            style={{
              width: '12%',
              height: `${Math.random() * 60 + 20}%`
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Pre-configured Recharts wrapper with consistent styling
 * Use this for all Line/Bar/Area charts
 */
export const chartDefaults = {
  // Common margin for all charts
  margin: { top: 8, right: 12, bottom: 8, left: 0 },
  
  // Color palette (house brand colors)
  colors: {
    primary: '#14b8a6',    // Teal (brand)
    secondary: '#6b7280',  // Gray
    success: '#16a34a',    // Green
    warning: '#d97706',    // Amber
    danger: '#dc2626',     // Red
    info: '#2563eb'        // Blue
  },
  
  // Common CartesianGrid props
  grid: {
    strokeDasharray: "3 3",
    stroke: "#e5e7eb",
    horizontal: true,
    vertical: false
  },
  
  // Common XAxis props
  xAxis: {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 12, fill: '#6b7280' }
  },
  
  // Common YAxis props  
  yAxis: {
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 12, fill: '#6b7280' },
    width: 36
  },
  
  // Common Tooltip props
  tooltip: {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    },
    cursor: { stroke: '#e5e7eb', strokeWidth: 1 }
  }
}

/**
 * Common chart responsive container
 */
export function ChartContainer({ children, height = 200 }) {
  return (
    <div style={{ width: '100%', height }}>
      {children}
    </div>
  )
}

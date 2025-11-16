import { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/utils/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  primaryAction?: {
    label: string
    onClick: () => void
    loading?: boolean
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  actions?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  actions,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex items-start justify-between gap-4')}>
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
      </div>
      {(primaryAction || secondaryAction || actions) && (
        <div className="flex items-center gap-2">
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button onClick={primaryAction.onClick} loading={primaryAction.loading}>
              {primaryAction.label}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  )
}


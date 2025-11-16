import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

interface KPICardProps {
  label: string
  value: string | number
  trend?: string
  loading?: boolean
}

export function KPICard({ label, value, trend, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{value}</span>
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { AlertTriangle, Calendar, DollarSign, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { RenewalAlert } from '../api'

interface RenewalAlertsProps {
  alerts: RenewalAlert[]
}

export function RenewalAlerts({ alerts }: RenewalAlertsProps) {
  const navigate = useNavigate()

  if (!alerts || alerts.length === 0) {
    return null
  }

  const getAlertVariant = (days: number): 'warning' | 'error' => {
    return days === 0 ? 'error' : 'warning'
  }

  const getAlertMessage = (days: number, cost: number) => {
    if (days === 0) {
      return `Renewal today - ${cost.toFixed(2)}€ will be charged or the number will be deleted`
    }
    return `${days} day${days > 1 ? 's' : ''} until renewal - ${cost.toFixed(2)}€ will be charged or the number will be deleted if insufficient budget`
  }

  const getAlertTitle = (days: number) => {
    if (days === 0) {
      return 'Phone number renewal due today'
    }
    return `Phone number renewal in ${days} day${days > 1 ? 's' : ''}`
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg font-semibold text-amber-900">
            Phone Number Renewals
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const variant = getAlertVariant(alert.days_until_renewal)
          const isUrgent = alert.days_until_renewal <= 2

          return (
            <div
              key={alert.phone_number_id}
              className={`rounded-lg border p-4 ${
                variant === 'error'
                  ? 'border-red-300 bg-red-50'
                  : isUrgent
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className={`h-4 w-4 ${variant === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
                    <span className="text-sm font-semibold text-foreground">
                      {alert.phone_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Renewal: {new Date(alert.renewal_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span>{alert.monthly_cost_usd.toFixed(2)}€/month</span>
                    </div>
                  </div>
                  <p
                    className={`text-sm ${
                      variant === 'error' ? 'text-red-800' : 'text-amber-800'
                    }`}
                  >
                    {getAlertMessage(alert.days_until_renewal, alert.monthly_cost_usd)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/numbers')}
                  className={variant === 'error' ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}
                >
                  View Numbers
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}


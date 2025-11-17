import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { CheckCircle2, AlertCircle, Phone, BookOpen, Bot, Users, ArrowRight } from 'lucide-react'

interface SetupItem {
  id: string
  type: 'number' | 'knowledge' | 'agent' | 'leads'
  label: string
  description: string
  completed: boolean
  actionLabel?: string
  onAction?: () => void
}

interface SetupChecklistProps {
  items: SetupItem[]
  totalCompleted: number
  totalItems: number
  onStartSetup?: () => void
}

const iconMap = {
  number: Phone,
  knowledge: BookOpen,
  agent: Bot,
  leads: Users,
}

export function SetupChecklist({
  items,
  totalCompleted,
  totalItems,
  onStartSetup,
}: SetupChecklistProps) {
  const isComplete = totalCompleted === totalItems

  if (isComplete) {
    return null
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Get started</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete these steps to launch your first campaign
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {totalCompleted} of {totalItems} completed
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const Icon = iconMap[item.type]
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                item.completed
                  ? 'border-border bg-muted/30'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 rounded-md p-2 ${
                    item.completed
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{item.label}</h3>
                    {item.completed && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {!item.completed && item.onAction && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={item.onAction}
                  className="ml-4"
                >
                  Set up
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )
        })}
        {onStartSetup && (
          <div className="pt-2">
            <Button onClick={onStartSetup} className="w-full" size="lg">
              Complete setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

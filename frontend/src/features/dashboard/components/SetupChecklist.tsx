import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { CheckCircle2, AlertCircle } from 'lucide-react'

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
  number: '📞',
  knowledge: '📚',
  agent: '🤖',
  leads: '👥',
}

export function SetupChecklist({
  items,
  totalCompleted,
  totalItems,
  onStartSetup,
}: SetupChecklistProps) {
  const isComplete = totalCompleted === totalItems

  return (
    <Card
      className={
        isComplete
          ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
      }
    >
      <CardHeader>
        <CardTitle
          className={
            isComplete ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
          }
        >
          {isComplete ? (
            <>
              <CheckCircle2 className="mr-2 inline h-5 w-5" />
              Sistema pronto per chiamare
            </>
          ) : (
            <>
              <AlertCircle className="mr-2 inline h-5 w-5" />
              Setup incompleto
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isComplete && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Per lanciare la prima campagna:
          </p>
        )}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{iconMap[item.type]}</span>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Completato
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                    Incompleto
                  </span>
                )}
                {!item.completed && item.onAction && (
                  <Button variant="secondary" size="sm" onClick={item.onAction}>
                    {item.actionLabel || 'Completa ora'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!isComplete && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Progress: {totalCompleted}/{totalItems} completati
            </p>
            {onStartSetup && (
              <Button onClick={onStartSetup} size="lg">
                Inizia Setup
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}


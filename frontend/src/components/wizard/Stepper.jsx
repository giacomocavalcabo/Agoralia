import { useI18n } from '../../lib/i18n.jsx'

export default function Stepper({ currentStep, totalSteps, steps }) {
  const { t } = useI18n()
  const progress = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Progress bar */}
      <div style={{
        width: '100%',
        height: 4,
        background: 'var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 16
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--indigo-600)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Step labels */}
      {steps && steps.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          {steps.map((step, index) => {
            const stepNumber = index + 1
            const isActive = stepNumber === currentStep
            const isCompleted = step.completed || stepNumber < currentStep
            const isUpcoming = stepNumber > currentStep

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 'fit-content'
                }}
              >
                {/* Step number circle */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  background: isCompleted 
                    ? 'var(--green)' 
                    : isActive 
                      ? 'var(--indigo-600)' 
                      : 'var(--border)',
                  color: isCompleted || isActive ? 'white' : 'var(--muted)',
                  flexShrink: 0
                }}>
                  {isCompleted ? '✓' : stepNumber}
                </div>

                {/* Step label */}
                {step.label && (
                  <div style={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text)' : isCompleted ? 'var(--muted)' : 'var(--muted)',
                    display: isUpcoming ? 'none' : 'block' // Hide upcoming steps on mobile
                  }}>
                    {step.label}
                  </div>
                )}

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    background: isCompleted ? 'var(--green)' : 'var(--border)',
                    margin: '0 8px',
                    display: isUpcoming ? 'none' : 'block' // Hide connector for upcoming steps on mobile
                  }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Progress text */}
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--muted)',
        marginTop: 12,
        textAlign: 'center'
      }}>
        {t('pages.dashboard.setup.progress', { completed: currentStep, total: totalSteps })}
      </div>
    </div>
  )
}


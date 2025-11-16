import { useI18n } from '../../lib/i18n.jsx'
import Button from '../ui/Button'
import Stepper from './Stepper'

export default function WizardContainer({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  canGoNext = true,
  canGoPrev = true,
  stepLabels
}) {
  const { t } = useI18n()

  const totalSteps = steps.length
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  function handleNext() {
    if (isLastStep) {
      onComplete?.()
    } else {
      onStepChange(currentStep + 1)
    }
  }

  function handlePrev() {
    if (!isFirstStep) {
      onStepChange(currentStep - 1)
    }
  }

  const stepItems = stepLabels || steps.map((_, index) => ({
    label: `Step ${index + 1}`,
    completed: index < currentStep
  }))

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Stepper */}
      <Stepper
        currentStep={currentStep + 1}
        totalSteps={totalSteps}
        steps={stepItems}
      />

      {/* Step content */}
      <div style={{ minHeight: '400px' }}>
        {steps[currentStep]}
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 24,
        borderTop: '1px solid var(--border)'
      }}>
        <Button
          variant="secondary"
          size="md"
          onClick={handlePrev}
          disabled={!canGoPrev || isFirstStep}
        >
          {t('common.prev')} {!isFirstStep && '←'}
        </Button>

        <div style={{ display: 'flex', gap: 8 }}>
          {!isLastStep && (
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              disabled={!canGoNext}
            >
              {t('common.next')} →
            </Button>
          )}
          {isLastStep && (
            <Button
              variant="primary"
              size="lg"
              onClick={onComplete}
              disabled={!canGoNext}
            >
              {t('common.complete') || 'Complete'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}


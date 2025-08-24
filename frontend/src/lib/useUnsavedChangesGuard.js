import { useEffect } from 'react'

export function useUnsavedChangesGuard(isDirty, message = 'Unsaved changes') {
  useEffect(() => {
    const handler = (e) => { 
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = message
      return message
    }
    
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, message])
}

import { useEffect, useRef } from 'react'

export function useAutosave(values, delay = 800, onSave = () => {}) {
  const first = useRef(true)
  
  useEffect(() => {
    if (first.current) { 
      first.current = false
      return
    }
    
    const id = setTimeout(() => onSave(values), delay)
    return () => clearTimeout(id)
  }, [JSON.stringify(values), delay, onSave]) // semplice, evita deep deps
  
  return {
    isSaving: false,
    handleChange: (value) => {
      // Trigger immediate change
      onSave(value)
    }
  }
}

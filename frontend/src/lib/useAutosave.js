import { useState, useCallback, useRef, useEffect } from 'react';
import { useUpdateKb } from './kbApi';

export function useAutosave(kbId, fieldKey, initialValue = '') {
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);
  const updateKb = useUpdateKb();

  const saveField = useCallback(async (newValue) => {
    if (!kbId || !fieldKey) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Update KB field
      await updateKb.mutateAsync({
        id: kbId,
        payload: {
          fields: {
            [fieldKey]: newValue
          }
        }
      });
      
      setLastSaved(new Date());
      setValue(newValue);
      
      // Toast di conferma
      if (window.toast) {
        window.toast.success(`Salvato • ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`);
      }
    } catch (err) {
      setError(err);
      console.error(`Autosave failed for ${fieldKey}:`, err);
      
      if (window.toast) {
        window.toast.error(`Errore salvataggio: ${err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, [kbId, fieldKey, updateKb]);

  const debouncedSave = useCallback((newValue) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      saveField(newValue);
    }, 800); // Debounce di 800ms
  }, [saveField]);

  const handleChange = useCallback((newValue) => {
    setValue(newValue);
    debouncedSave(newValue);
  }, [debouncedSave]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Update value when initialValue changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    setValue,
    handleChange,
    isSaving,
    lastSaved,
    error,
    saveField // Per salvataggio immediato se necessario
  };
}

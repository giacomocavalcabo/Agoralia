import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useImportStore = create(
  persist(
    (set, get) => ({
      // Wizard state
      currentStep: 1,
      importData: null,
      mappingData: null,
      jobId: null,
      
      // Step 1: Upload & Detect
      csvData: null,
      isProcessing: false,
      
      // Step 2: Field Mapping
      fieldMappings: {},
      prefixConfig: {
        strategy: 'auto', // 'auto', '+39', '0039', 'none'
        defaultCountry: 'IT',
        applyToAll: false
      },
      dedupeConfig: {
        onPhone: true,
        onEmail: false,
        resolveStrategy: 'skip' // 'skip', 'merge'
      },
      
      // Step 3: Review & Launch
      isLaunching: false,
      importStats: {
        totalRows: 0,
        estimatedNew: 0,
        estimatedUpdates: 0,
        estimatedDuplicates: 0
      },
      
      // Actions
      setCurrentStep: (step) => set({ currentStep: step }),
      
      setImportData: (data) => set({ importData: data }),
      
      setMappingData: (mapping) => set({ mappingData: mapping }),
      
      setCsvData: (data) => set({ csvData: data }),
      
      setIsProcessing: (processing) => set({ isProcessing: processing }),
      
      setFieldMappings: (mappings) => set({ fieldMappings: mappings }),
      
      updatePrefixConfig: (config) => set((state) => ({
        prefixConfig: { ...state.prefixConfig, ...config }
      })),
      
      updateDedupeConfig: (config) => set((state) => ({
        dedupeConfig: { ...state.dedupeConfig, ...config }
      })),
      
      setIsLaunching: (launching) => set({ isLaunching: launching }),
      
      setJobId: (id) => set({ jobId: id }),
      
      calculateImportStats: () => {
        const { importData } = get()
        if (!importData?.data) return
        
        const totalRows = importData.data.length
        const estimatedNew = Math.floor(totalRows * 0.7)
        const estimatedUpdates = Math.floor(totalRows * 0.2)
        const estimatedDuplicates = Math.floor(totalRows * 0.1)
        
        set({
          importStats: {
            totalRows,
            estimatedNew,
            estimatedUpdates,
            estimatedDuplicates
          }
        })
      },
      
      // Auto-detect field types
      autoDetectFields: () => {
        const { importData } = get()
        if (!importData?.meta?.fields) return
        
        const autoMappings = {}
        importData.meta.fields.forEach(field => {
          const fieldLower = field.toLowerCase()
          if (fieldLower.includes('phone') || fieldLower.includes('tel') || fieldLower.includes('mobile')) {
            autoMappings[field] = 'phone'
          } else if (fieldLower.includes('name') || fieldLower.includes('nome')) {
            autoMappings[field] = 'name'
          } else if (fieldLower.includes('email') || fieldLower.includes('mail')) {
            autoMappings[field] = 'email'
          } else if (fieldLower.includes('company') || fieldLower.includes('azienda') || fieldLower.includes('società')) {
            autoMappings[field] = 'company'
          } else if (fieldLower.includes('country') || fieldLower.includes('paese')) {
            autoMappings[field] = 'country'
          } else {
            autoMappings[field] = 'custom'
          }
        })
        
        set({ fieldMappings: autoMappings })
      },
      
      // Reset wizard
      resetWizard: () => set({
        currentStep: 1,
        importData: null,
        mappingData: null,
        jobId: null,
        csvData: null,
        isProcessing: false,
        fieldMappings: {},
        prefixConfig: {
          strategy: 'auto',
          defaultCountry: 'IT',
          applyToAll: false
        },
        dedupeConfig: {
          onPhone: true,
          onEmail: false,
          resolveStrategy: 'skip'
        },
        isLaunching: false,
        importStats: {
          totalRows: 0,
          estimatedNew: 0,
          estimatedUpdates: 0,
          estimatedDuplicates: 0
        }
      }),
      
      // Navigation helpers
      nextStep: () => {
        const { currentStep } = get()
        if (currentStep < 3) {
          set({ currentStep: currentStep + 1 })
        }
      },
      
      prevStep: () => {
        const { currentStep } = get()
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 })
        }
      },
      
      canGoNext: () => {
        const { currentStep, importData, mappingData } = get()
        
        switch (currentStep) {
          case 1:
            return !!importData
          case 2:
            return !!mappingData?.fieldMappings && 
                   Object.keys(mappingData.fieldMappings).length > 0
          case 3:
            return true
          default:
            return false
        }
      }
    }),
    {
      name: 'import-wizard-storage',
      partialize: (state) => ({
        prefixConfig: state.prefixConfig,
        dedupeConfig: state.dedupeConfig
      })
    }
  )
)

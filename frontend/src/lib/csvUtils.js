import Papa from 'papaparse'

/**
 * Detect CSV delimiter and handle BOM
 * @param {string} content - Raw CSV content
 * @returns {object} { delimiter: string, hasBOM: boolean, cleanContent: string }
 */
export function detectCSVFormat(content) {
  if (!content || typeof content !== 'string') {
    return { delimiter: ',', hasBOM: false, cleanContent: '' }
  }

  let cleanContent = content
  let hasBOM = false

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    cleanContent = content.slice(1)
    hasBOM = true
  }

  // Detect delimiter by analyzing first few lines
  const lines = cleanContent.split('\n').slice(0, 5)
  const delimiterCounts = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  
  lines.forEach(line => {
    if (line.trim()) {
      delimiterCounts[','] += (line.match(/,/g) || []).length
      delimiterCounts[';'] += (line.match(/;/g) || []).length
      delimiterCounts['\t'] += (line.match(/\t/g) || []).length
      delimiterCounts['|'] += (line.match(/\|/g) || []).length
    }
  })

  // Find most common delimiter
  const delimiter = Object.entries(delimiterCounts)
    .sort(([,a], [,b]) => b - a)[0][0]

  return { delimiter, hasBOM, cleanContent }
}

/**
 * Parse CSV with robust error handling
 * @param {string} content - CSV content
 * @param {object} options - Parsing options
 * @returns {object} { data: array, meta: object, errors: array }
 */
export function parseCSV(content, options = {}) {
  const { delimiter, hasBOM, cleanContent } = detectCSVFormat(content)
  
  const config = {
    delimiter,
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header?.trim() || '',
    transform: (value, field) => {
      if (typeof value === 'string') {
        // Protect against CSV injection
        if (value.match(/^[=+\-@]/)) {
          return "'" + value
        }
        return value.trim()
      }
      return value
    },
    ...options
  }

  return new Promise((resolve) => {
    Papa.parse(cleanContent, {
      ...config,
      complete: (results) => {
        const { data, meta, errors } = results
        
        // Filter out completely empty rows
        const cleanData = data.filter(row => 
          Object.values(row).some(value => value !== null && value !== undefined && value !== '')
        )

        resolve({
          data: cleanData,
          meta: {
            ...meta,
            delimiter,
            hasBOM,
            totalRows: cleanData.length,
            fields: meta.fields || []
          },
          errors: errors || []
        })
      }
    })
  })
}

/**
 * Validate CSV data for required fields
 * @param {array} data - Parsed CSV data
 * @param {array} requiredFields - Required field names
 * @returns {object} { isValid: boolean, missingFields: array, emptyRows: array }
 */
export function validateCSVData(data, requiredFields = []) {
  if (!Array.isArray(data) || data.length === 0) {
    return { isValid: false, missingFields: requiredFields, emptyRows: [] }
  }

  const missingFields = []
  const emptyRows = []

  // Check for required fields
  if (data.length > 0) {
    const availableFields = Object.keys(data[0])
    requiredFields.forEach(field => {
      if (!availableFields.includes(field)) {
        missingFields.push(field)
      }
    })
  }

  // Check for empty required fields in rows
  data.forEach((row, index) => {
    const hasEmptyRequired = requiredFields.some(field => {
      const value = row[field]
      return !value || (typeof value === 'string' && value.trim() === '')
    })
    
    if (hasEmptyRequired) {
      emptyRows.push({ rowIndex: index + 1, row })
    }
  })

  return {
    isValid: missingFields.length === 0 && emptyRows.length === 0,
    missingFields,
    emptyRows
  }
}

/**
 * Detect field types based on content analysis
 * @param {array} data - CSV data
 * @param {array} fields - Field names
 * @returns {object} Field type mapping
 */
export function detectFieldTypes(data, fields) {
  const typeMapping = {}
  
  fields.forEach(field => {
    const values = data.slice(0, 100).map(row => row[field]).filter(Boolean)
    
    if (values.length === 0) {
      typeMapping[field] = 'unknown'
      return
    }

    // Phone number detection
    const phonePattern = /^[\+]?[0-9\s\-\(\)]+$/
    const isPhone = values.some(v => phonePattern.test(v) && v.length >= 8)
    
    // Email detection
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isEmail = values.some(v => emailPattern.test(v))
    
    // Date detection
    const datePattern = /^\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}$/
    const isDate = values.some(v => datePattern.test(v))
    
    // Number detection
    const numberPattern = /^[\d\.,]+$/
    const isNumber = values.some(v => numberPattern.test(v) && !isDate)
    
    if (isPhone) {
      typeMapping[field] = 'phone'
    } else if (isEmail) {
      typeMapping[field] = 'email'
    } else if (isDate) {
      typeMapping[field] = 'date'
    } else if (isNumber) {
      typeMapping[field] = 'number'
    } else {
      typeMapping[field] = 'text'
    }
  })

  return typeMapping
}

/**
 * Export data to CSV with injection protection
 * @param {array} data - Data to export
 * @param {array} fields - Fields to include
 * @returns {string} CSV string
 */
export function exportToCSV(data, fields) {
  if (!Array.isArray(data) || data.length === 0) {
    return ''
  }

  // Protect against CSV injection
  const protectValue = (value) => {
    if (typeof value === 'string' && value.match(/^[=+\-@]/)) {
      return "'" + value
    }
    return value
  }

  const headers = fields.map(field => `"${field}"`).join(',')
  const rows = data.map(row => 
    fields.map(field => `"${protectValue(row[field] || '')}"`).join(',')
  )

  return [headers, ...rows].join('\n')
}

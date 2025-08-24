import React from 'react'

export default function ImportDataTable({ 
  data = [], 
  columns = [], 
  className = '',
  selectable = false,
  selectedRowIds = new Set(),
  onSelectionChange,
  virtualizeIf = false
}) {
  const handleSelectAll = () => {
    if (!onSelectionChange) return
    
    if (selectedRowIds.size === data.length) {
      // Deselect all
      onSelectionChange(new Set())
    } else {
      // Select all
      onSelectionChange(new Set(data.map((_, index) => index)))
    }
  }

  const handleRowSelect = (index) => {
    if (!onSelectionChange) return
    
    const newSelection = new Set(selectedRowIds)
    if (newSelection.has(index)) {
      newSelection.delete(index)
    } else {
      newSelection.add(index)
    }
    onSelectionChange(newSelection)
  }

  const isAllSelected = data.length > 0 && selectedRowIds.size === data.length
  const isIndeterminate = selectedRowIds.size > 0 && selectedRowIds.size < data.length

  return (
    <div className={`overflow-hidden ${className}`}>
      <table className="w-full">
        <thead className="sticky top-0 bg-white border-b border-gray-200">
          <tr>
            {selectable && (
              <th className="w-12 p-3 text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate
                  }}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
            )}
            {columns.map((column) => (
              <th 
                key={column.key} 
                className={`text-left text-sm font-medium text-gray-900 p-3 ${column.width || ''}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-gray-50">
              {selectable && (
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selectedRowIds.has(index)}
                    onChange={() => handleRowSelect(index)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key} className="p-3 text-sm text-gray-900">
                  {column.render ? column.render(row[column.key], row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td 
                colSpan={selectable ? columns.length + 1 : columns.length} 
                className="p-8 text-center text-sm text-gray-500"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

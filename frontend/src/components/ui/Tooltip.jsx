import React, { useState } from 'react'
import { Info } from "lucide-react"

export default function Tooltip({
  label,
  ariaLabel,
  children,
  className = ""
}) {
  const [open, setOpen] = useState(false)
  
  return (
    <span className={`inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel || label}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="ml-2 h-5 w-5 grid place-items-center rounded-full border border-gray-300"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span role="tooltip" className="ml-2 rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow">
          {children || label}
        </span>
      )}
    </span>
  )
}
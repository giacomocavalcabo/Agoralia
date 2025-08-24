import { useState, useEffect } from 'react';

/**
 * E.164 phone number format regex
 * Validates: + followed by country code (1-4 digits) and national number (4-15 digits)
 * Total length: 7-15 digits after the +
 */
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * CallerIdInput component that normalizes and validates phone numbers in E.164 format
 * 
 * @param {string} value - Current phone number value
 * @param {function} onChange - Callback when the normalized value changes
 * @param {function} onValidChange - Callback when validation status changes
 * @param {string} placeholder - Placeholder text
 * @param {string} ariaLabel - Accessibility label
 */
export default function CallerIdInput({ 
  value, 
  onChange, 
  placeholder = "+12025550123", 
  ariaLabel,
  onValidChange 
}) {
  const [inputValue, setInputValue] = useState(value || '');

  useEffect(() => {
    // Normalize: remove non-digit/non-+ characters, replace 00 prefix with +
    const normalized = inputValue
      .replace(/[^\d+]/g, '')
      .replace(/^00/, '+');
    
    // Validate against E.164 format
    const isValid = E164_REGEX.test(normalized);
    
    // Call callbacks
    onChange?.(normalized);
    onValidChange?.(isValid);
  }, [inputValue, onChange, onValidChange]);

  // Update internal state when external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]); // Don't include inputValue to avoid infinite loop

  return (
    <input
      type="tel"
      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}

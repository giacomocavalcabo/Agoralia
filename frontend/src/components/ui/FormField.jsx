/**
 * Reusable form field component with proper accessibility attributes
 * Follows WCAG guidelines for form accessibility
 * 
 * @param {string} label - The field label text
 * @param {string} htmlFor - The ID of the form control this label is for
 * @param {string} description - Optional help text
 * @param {string} error - Error message to display
 * @param {React.ReactNode} children - The form control element
 */
export default function FormField({ label, htmlFor, description, error, children }) {
  const descId = description ? `${htmlFor}-desc` : undefined;
  const errId = error ? `${htmlFor}-err` : undefined;
  
  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={htmlFor} 
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      {children}
      {description && (
        <p 
          id={descId} 
          className="text-xs text-gray-500"
        >
          {description}
        </p>
      )}
      {error && (
        <p 
          id={errId} 
          className="text-xs text-red-600"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

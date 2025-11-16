export default function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'btn',
    variant === 'primary' ? 'primary' : '',
    size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '',
    (disabled || loading) ? 'btn-disabled' : '',
    className
  ].filter(Boolean).join(' ')
  return (
    <button {...props} className={classes} disabled={disabled || loading}>
      {loading ? '...' : children}
    </button>
  )
}



export default function Button({ variant = 'default', className = '', ...props }) {
  const classes = [
    'btn',
    variant === 'primary' ? 'primary' : '',
    className
  ].filter(Boolean).join(' ')
  return <button {...props} className={classes} />
}



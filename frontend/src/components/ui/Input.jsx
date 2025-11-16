export default function Input({ className = '', ...props }) {
  const classes = ['input', className].filter(Boolean).join(' ')
  return <input {...props} className={classes} />
}



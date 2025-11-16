export default function Card({ className = '', ...props }) {
  const classes = ['panel', className].filter(Boolean).join(' ')
  return <div {...props} className={classes} />
}



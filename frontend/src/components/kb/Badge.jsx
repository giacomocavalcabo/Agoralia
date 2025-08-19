import { Badge as UIBadge } from '../ui/Badge';

export function KBBadge({ 
  status, 
  variant = 'default',
  children 
}) {
  const statusVariants = {
    complete: 'bg-green-100 text-green-800 border-green-200',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    stale: 'bg-red-100 text-red-800 border-red-200',
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    published: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const variantClasses = statusVariants[status] || statusVariants.draft;

  return (
    <UIBadge 
      variant={variant}
      className={`${variantClasses} border`}
    >
      {children || status}
    </UIBadge>
  );
}

import React from 'react';

const cn = (...cls) => cls.filter(Boolean).join(' ');

// Sistema dimensioni per layout a mosaico
const sizeMap = {
  sm: 'col-span-12 md:col-span-6 row-span-1',
  md: 'col-span-12 md:col-span-6 row-span-2', 
  lg: 'col-span-12 row-span-2'
};

/** Nuovi primitivi (named exports) */
export function Card({ className = '', title, footer, children, size = 'md', ...props }) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-gray-200 shadow-sm',
        sizeMap[size],
        className
      )}
      {...props}
    >
      {/* Retro-compatibilità: se passi `title`, renderizziamo un header semplice */}
      {typeof title !== 'undefined' && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}

      {/* NB: non forziamo un wrapper/padding qui per non doppiare con CardContent */}
      {children}

      {/* Retro-compat: se passi `footer`, lo incapsuliamo in CardFooter */}
      {typeof footer !== 'undefined' && <CardFooter>{footer}</CardFooter>}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div
      className={cn('p-6 border-b border-gray-200', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, as: As = 'h3', ...props }) {
  return (
    <As className={cn('text-lg font-semibold leading-6 text-gray-900', className)} {...props}>
      {children}
    </As>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div
      className={cn('p-4 border-t border-gray-200 bg-gray-50', className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Default export per compatibilità con gli import esistenti */
export default Card;
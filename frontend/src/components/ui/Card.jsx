import React from 'react';

const cn = (...cls) => cls.filter(Boolean).join(' ');

/** Nuovi primitivi (named exports) */
export function Card({ className = '', title, footer, children, ...props }) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-gray-200 shadow-sm',
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
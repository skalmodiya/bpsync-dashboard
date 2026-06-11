import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className, title, description }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className
      )}
    >
      {(title || description) && (
        <div className="flex flex-col space-y-1.5 p-6 pb-4">
          {title && <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={title || description ? 'p-6 pt-0' : 'p-6'}>{children}</div>
    </div>
  );
}

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
        'rounded-xl border border-border/60 bg-card/90 text-card-foreground',
        'shadow-card backdrop-blur-sm',
        'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-px hover:bg-card',
        className
      )}
    >
      {(title || description) && (
        <div className="flex flex-col space-y-1 px-4 pt-4 pb-3 border-b border-border/50
          bg-gradient-to-r from-muted/40 via-muted/20 to-transparent rounded-t-xl">
          {title && (
            <h3 className="text-base font-semibold leading-tight tracking-tight">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      )}
      <div className={title || description ? 'p-4 pt-3' : 'p-4'}>{children}</div>
    </div>
  );
}

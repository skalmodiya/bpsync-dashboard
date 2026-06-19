import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  loading?: boolean;
}

const variants = {
  primary:
    'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground ' +
    'hover:from-primary/95 hover:to-primary/75 ' +
    'shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 ' +
    'hover:-translate-y-px active:translate-y-0',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/75 ' +
    'shadow-sm hover:shadow-md transition-shadow',
  destructive:
    'bg-gradient-to-r from-destructive to-destructive/85 text-destructive-foreground ' +
    'hover:from-destructive/90 hover:to-destructive/75 ' +
    'shadow-md shadow-destructive/20 hover:shadow-lg hover:shadow-destructive/25 ' +
    'hover:-translate-y-px active:translate-y-0',
  outline:
    'border border-border/70 bg-background/90 text-foreground ' +
    'hover:bg-muted/60 hover:border-border hover:shadow-sm',
  ghost:
    'text-foreground hover:bg-muted/70 hover:text-foreground',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

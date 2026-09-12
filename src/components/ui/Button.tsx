import { Loader2 } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = {
  base: 'inline-flex items-center justify-center font-semibold transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-notar-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
  variant: {
    primary:
      'bg-notar-500 text-notar-950 hover:bg-notar-600 active:bg-notar-700 border border-transparent shadow-xs',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-200',
    outline:
      'border border-slate-200 bg-background hover:bg-muted text-foreground active:bg-slate-100',
    ghost:
      'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200',
  },
  size: {
    sm: 'text-sm px-3.5 py-1.5 rounded-md gap-1.5',
    md: 'text-base px-4 py-2 rounded-md gap-2 shadow-xs',
    lg: 'text-lg px-5 py-2.5 rounded-md gap-2.5 shadow-xs',
  },
} as const;

export type ButtonVariant = keyof typeof buttonVariants.variant;
export type ButtonSize = keyof typeof buttonVariants.size;

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    buttonVariants.base,
    buttonVariants.variant[variant],
    buttonVariants.size[size],
    className
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-current" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

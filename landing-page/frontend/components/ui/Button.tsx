'use client';

import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'white';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  arrow?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover hover:shadow-md active:scale-[0.98] active:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  secondary:
    'bg-transparent text-primary hover:text-primary-hover px-0',
  ghost:
    'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/50',
  white:
    'bg-white text-primary hover:bg-gray-50 hover:shadow-md active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-caption',
  md: 'h-11 px-6 text-body-sm',
  lg: 'h-[52px] px-8 text-body-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', arrow, className = '', children, href, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
    const styles = `${base} ${variant !== 'secondary' ? sizeStyles[size] : 'py-3'} ${variantStyles[variant]} ${className}`;

    if (href) {
      return (
        <a href={href} className={styles}>
          {children}
          {arrow && <span className="ml-1.5 transition-transform duration-150 group-hover:translate-x-1">&rarr;</span>}
        </a>
      );
    }

    return (
      <button ref={ref} className={styles} {...props}>
        {children}
        {arrow && <span className="ml-1.5 transition-transform duration-150 group-hover:translate-x-1">&rarr;</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

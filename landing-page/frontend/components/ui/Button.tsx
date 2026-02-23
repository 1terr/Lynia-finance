'use client';

import { forwardRef } from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'white' | 'accent' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  arrow?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-navy text-white shadow-stripe-sm hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-stripe active:translate-y-0 active:shadow-stripe-xs focus-visible:outline-none focus-visible:shadow-stripe-focus',
  secondary:
    'bg-transparent text-primary hover:text-primary-hover px-0',
  ghost:
    'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/50 hover:-translate-y-0.5 active:translate-y-0',
  white:
    'bg-white text-primary shadow-stripe-sm hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-stripe active:translate-y-0 active:shadow-stripe-xs',
  accent:
    'bg-primary text-white shadow-stripe-sm hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-stripe active:translate-y-0 active:shadow-stripe-xs focus-visible:outline-none focus-visible:shadow-stripe-focus',
  outline:
    'bg-transparent text-primary-dark border border-border shadow-stripe-xs hover:bg-surface-secondary hover:border-border-strong hover:-translate-y-0.5 hover:shadow-stripe-sm active:translate-y-0 active:shadow-stripe-xs focus-visible:outline-none focus-visible:shadow-stripe-focus',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-caption rounded-md',
  md: 'h-11 px-6 text-body rounded-full',
  lg: 'h-[52px] px-8 text-body rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', arrow, className = '', children, href, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold transition-all duration-250 ease-stripe disabled:opacity-50 disabled:cursor-not-allowed';
    const styles = `${base} ${variant !== 'secondary' ? sizeStyles[size] : 'py-3'} ${variantStyles[variant]} ${className}`;

    const arrowEl = arrow ? (
      <span className="ml-1.5 transition-transform duration-250 ease-stripe-out group-hover:translate-x-1">&rarr;</span>
    ) : null;

    if (href) {
      const isExternal = href.startsWith('http');
      if (isExternal) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className={styles}>
            {children}
            {arrowEl}
          </a>
        );
      }
      return (
        <Link href={href} className={styles}>
          {children}
          {arrowEl}
        </Link>
      );
    }

    return (
      <button ref={ref} className={styles} {...props}>
        {children}
        {arrowEl}
      </button>
    );
  }
);

Button.displayName = 'Button';

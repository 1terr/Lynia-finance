'use client';

import { forwardRef } from 'react';
import Link from 'next/link';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'white' | 'accent' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  href?: string;
  arrow?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-white text-[#08090A] shadow-btn hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-stripe-sm active:translate-y-0 active:shadow-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
  secondary:
    'bg-transparent text-primary hover:text-primary-hover px-0 shadow-none',
  ghost:
    'bg-transparent text-white border border-white/30 shadow-btn hover:bg-white/10 hover:border-white/50 hover:-translate-y-0.5 active:translate-y-0',
  white:
    'bg-white text-[#08090A] shadow-btn hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-stripe-sm active:translate-y-0 active:shadow-btn',
  accent:
    'bg-primary text-white shadow-btn hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-stripe-sm active:translate-y-0 active:shadow-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
  outline:
    'bg-white text-[#08090A] border border-border shadow-btn hover:bg-surface-secondary hover:border-border-strong hover:-translate-y-0.5 hover:shadow-stripe-sm active:translate-y-0 active:shadow-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', arrow, className = '', children, href, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center h-8 px-3 text-[13px] font-medium tracking-[-0.01em] rounded-sm transition-all duration-250 ease-stripe disabled:opacity-50 disabled:cursor-not-allowed';
    const styles = `${base} ${variantStyles[variant]} ${className}`;

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
import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ initials, size = 'md', className, ...props }: AvatarProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-medium',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {initials.toUpperCase()}
    </div>
  );
}

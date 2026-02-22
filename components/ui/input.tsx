import * as React from 'react';

import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-offset-2 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-300',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

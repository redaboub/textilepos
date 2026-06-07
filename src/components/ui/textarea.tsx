import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm shadow-sm resize-none transition-colors',
        'placeholder:text-muted-foreground/60',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };

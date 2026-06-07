'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
}

export function Sheet({ open, onOpenChange, children, side = 'left' }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity xl:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'fixed inset-y-0 z-50 bg-card shadow-2xl transition-transform duration-300 ease-out xl:hidden',
          side === 'left' ? 'left-0' : 'right-0',
          open
            ? 'translate-x-0'
            : side === 'left'
            ? '-translate-x-full'
            : 'translate-x-full'
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className={cn(
            'absolute top-4 z-10 rounded-md p-1.5 bg-background/80 hover:bg-background shadow-sm',
            side === 'left' ? 'right-4' : 'left-4'
          )}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </>
  );
}

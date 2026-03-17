'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomBarDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  disabled?: boolean;
  panelWidthClassName?: string;
}

export default function BottomBarDropdown({
  open,
  onOpenChange,
  trigger,
  children,
  triggerClassName,
  panelClassName,
  panelWidthClassName = 'w-[320px]',
  disabled
}: BottomBarDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current || !open) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onOpenChange]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        disabled={disabled}
        data-open={open}
        className={cn(
          'bottom-bar-dropdown-trigger flex items-center justify-between gap-3 h-12 px-3 border border-gray-200 rounded-[20px] bg-white text-gray-700 transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-60',
          triggerClassName
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {trigger}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'bottom-bar-dropdown-panel absolute bottom-14 left-0 bg-white border border-gray-200 rounded-[20px] shadow-lg p-3',
            panelWidthClassName,
            panelClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

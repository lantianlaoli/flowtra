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
          'bottom-bar-dropdown-trigger my-ads-button my-ads-button--secondary inline-flex h-11 w-fit max-w-full items-center justify-start gap-1 rounded-[14px] border border-[#dfdfd9] bg-white pl-3 pr-2.5 text-gray-700 transition-all disabled:cursor-not-allowed disabled:opacity-60',
          triggerClassName
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {trigger}
        </div>
        <ChevronDown className={cn('h-[15px] w-[15px] flex-shrink-0 text-[#8a8a84] transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className={cn(
            'bottom-bar-dropdown-panel absolute bottom-13 left-0 rounded-[16px] border border-[#e4e4df] bg-white p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.10)]',
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

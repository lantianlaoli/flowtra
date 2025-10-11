'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer } from '@/components/ui/Toast';
import type { ToastType, ToastProps } from '@/components/ui/Toast';

interface ToastAction {
  label: string;
  href: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
  showSuccess: (message: string, duration?: number, action?: ToastAction) => void;
  showError: (message: string, duration?: number, action?: ToastAction) => void;
  showWarning: (message: string, duration?: number, action?: ToastAction) => void;
  showInfo: (message: string, duration?: number, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 5000, action?: ToastAction) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: ToastProps = {
        id,
        message,
        type,
        duration,
        onClose: removeToast,
        actionLabel: action?.label,
        actionHref: action?.href,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number, action?: ToastAction) => showToast(message, 'success', duration, action),
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number, action?: ToastAction) => showToast(message, 'error', duration, action),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number, action?: ToastAction) => showToast(message, 'warning', duration, action),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number, action?: ToastAction) => showToast(message, 'info', duration, action),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showWarning, showInfo }}
    >
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog Card */}
          <motion.div
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Icon */}
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center mb-4
                ${variant === 'danger' ? 'bg-red-100' : 'bg-orange-100'}
              `}>
                <AlertTriangle className={`
                  w-6 h-6
                  ${variant === 'danger' ? 'text-red-600' : 'text-orange-600'}
                `} />
              </div>

              {/* Title and Message */}
              <h3
                id="dialog-title"
                className="text-lg font-semibold text-gray-900 mb-2"
              >
                {title}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {message}
              </p>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`
                    flex-1 px-4 py-2.5 rounded-lg transition-colors font-medium text-white
                    ${variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                    }
                  `}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

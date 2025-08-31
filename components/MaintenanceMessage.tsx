'use client';

import { ExternalLink, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MaintenanceMessage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="text-center space-y-6">
          {/* Maintenance icon */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <Wrench className="w-6 h-6 text-gray-600" />
          </div>
          
          {/* Simple message */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Service Under Maintenance
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              We apologize for the inconvenience. Our service is temporarily unavailable.
            </p>
          </div>
          
          {/* Support link */}
          <div className="pt-4">
            <button
              onClick={() => router.push('/dashboard/support')}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
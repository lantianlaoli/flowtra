'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

export default function FeedbackWidget() {
  return (
    <Link
      href="/dashboard/support"
      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
    >
      <MessageSquare className="w-5 h-5" />
      <span className="font-medium">Support</span>
    </Link>
  );
}
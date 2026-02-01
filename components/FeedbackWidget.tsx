'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';

export default function FeedbackWidget() {
  return (
    <Link
      href="/dashboard/support"
      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-200"
    >
      <MessageSquare className="w-5 h-5" />
      <span>Having trouble?</span>
    </Link>
  );
}

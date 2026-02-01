'use client';

import Image from 'next/image';
import { User } from 'lucide-react';

interface UserProfileProps {
  userEmail?: string;
  userImageUrl?: string;
}

export default function UserProfile({ userEmail, userImageUrl }: UserProfileProps) {
  if (!userEmail) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 group hover:border-border/70 transition-colors duration-200">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-border/60">
          {userImageUrl ? (
            <Image
              src={userImageUrl}
              alt={userEmail}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          )}
        </div>

        {/* Email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate font-normal leading-tight">
            {userEmail}
          </p>
        </div>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';

// Backward compatibility redirect for old character-ads dashboard route
// Redirects /dashboard/character-ads to /dashboard/avatar-ads
// This redirect will be maintained for 3 months from 2025-12-21 to allow gradual migration
// Remove after 2026-03-21

export default function CharacterAdsRedirect() {
  redirect('/dashboard/avatar-ads');
}

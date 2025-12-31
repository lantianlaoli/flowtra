import { Mail } from 'lucide-react';
import {
  FaXTwitter,
  FaLinkedin,
  FaTiktok,
  FaThreads,
  FaInstagram,
  FaDiscord,
  FaYoutube
} from 'react-icons/fa6';

export interface SocialLink {
  label: string;
  href: string;
  icon: any; // React component
  description?: string;
}

/**
 * Get all configured social media links with icons
 * Filters out links with missing environment variables
 * @returns Array of social link objects with label, href, and icon component
 */
export function getSocialMediaLinks(): SocialLink[] {
  // LinkedIn URL formatting helper
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN
    ? process.env.NEXT_PUBLIC_LINKEDIN.startsWith('http')
      ? process.env.NEXT_PUBLIC_LINKEDIN
      : `https://${process.env.NEXT_PUBLIC_LINKEDIN}`
    : '';

  const links: SocialLink[] = [
    {
      label: 'Email',
      href: process.env.NEXT_PUBLIC_EMAIL ? `mailto:${process.env.NEXT_PUBLIC_EMAIL}` : '',
      icon: Mail,
      description: 'Send us an email'
    },
    {
      label: 'X',
      href: process.env.NEXT_PUBLIC_X || '',
      icon: FaXTwitter,
      description: 'Follow us on X (Twitter)'
    },
    {
      label: 'LinkedIn',
      href: linkedinUrl,
      icon: FaLinkedin,
      description: 'Connect on LinkedIn'
    },
    {
      label: 'TikTok',
      href: process.env.NEXT_PUBLIC_TIKTOK || '',
      icon: FaTiktok,
      description: 'Watch our TikTok videos'
    },
    {
      label: 'Threads',
      href: process.env.NEXT_PUBLIC_THREADS || '',
      icon: FaThreads,
      description: 'Follow us on Threads'
    },
    {
      label: 'Instagram',
      href: process.env.NEXT_PUBLIC_INSTAGRAM || '',
      icon: FaInstagram,
      description: 'Follow us on Instagram'
    },
    {
      label: 'YouTube',
      href: process.env.NEXT_PUBLIC_YOUTUBE || '',
      icon: FaYoutube,
      description: 'Subscribe to our YouTube channel'
    },
    {
      label: 'Discord',
      href: process.env.NEXT_PUBLIC_DISCORD || '',
      icon: FaDiscord,
      description: 'Join our Discord community'
    }
  ];

  // Filter out links with missing environment variables
  return links.filter(link => link.href);
}

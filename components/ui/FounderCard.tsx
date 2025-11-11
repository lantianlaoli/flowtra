'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { FaTiktok } from 'react-icons/fa6';

interface FounderCardProps {
  variant?: 'compact' | 'hero' | 'featured';
  showGreeting?: boolean;
  className?: string;
}

export default function FounderCard({
  variant = 'compact',
  showGreeting = true,
  className = ''
}: FounderCardProps) {
  const founderImageUrl = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/founder.png';
  const tiktokUrl = 'https://www.tiktok.com/@laolilantian';
  const tiktokUsername = '@laolilantian';

  // Variant-specific configurations
  const avatarSize = variant === 'featured' ? 128 : variant === 'hero' ? 64 : 80;
  const showFullGreeting = variant === 'featured';

  // Hero variant - Notion-style badge (matching Black Friday style)
  if (variant === 'hero') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`inline-flex ${className}`}
      >
        <div className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-[#fafafa] border border-[#e9e9e7] rounded-full text-sm hover:bg-[#f5f5f5] transition-colors">
          {/* Avatar - compact */}
          <div className="relative flex-shrink-0">
            <div className="w-5 h-5 rounded-full overflow-hidden border border-[#e9e9e7]">
              <Image
                src={founderImageUrl}
                alt="Founder"
                width={20}
                height={20}
                className="object-cover"
                priority
              />
            </div>
            {/* Online indicator - minimal */}
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-[#fafafa]" />
          </div>

          {/* Separator */}
          <div className="text-[#d9d9d7]">·</div>

          {/* Content - compact */}
          <span className="text-[#37352f] font-medium">Need help?</span>

          {/* Separator */}
          <div className="text-[#d9d9d7]">·</div>

          {/* TikTok link */}
          <a
            href={tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <FaTiktok className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">DM founder</span>
          </a>
        </div>
      </motion.div>
    );
  }

  // Featured variant - for support page
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`group relative ${className}`}
    >
      {/* Glass morphism card */}
      <div className="relative overflow-hidden rounded-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Gradient background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className={`relative ${variant === 'featured' ? 'p-8' : 'p-6'}`}>
          <div className={`flex ${variant === 'featured' ? 'flex-col items-center text-center' : 'items-start gap-4'}`}>
            {/* Avatar with glow effect */}
            <motion.div
              className="relative flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500" />
              <div className="relative rounded-full overflow-hidden border-4 border-white/50 dark:border-gray-800/50 shadow-lg">
                <Image
                  src={founderImageUrl}
                  alt="Founder"
                  width={avatarSize}
                  height={avatarSize}
                  className="object-cover"
                  priority
                />
              </div>
              {/* Online indicator */}
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-lg">
                <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75" />
              </div>
            </motion.div>

            {/* Content */}
            <div className={`flex-1 ${variant === 'featured' ? 'mt-6' : ''}`}>
              {/* Greeting */}
              {showGreeting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <span className="text-2xl">👋</span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {showFullGreeting ? 'Got questions? Reach out anytime!' : 'Hi there!'}
                  </span>
                </motion.div>
              )}

              {/* TikTok link */}
              <motion.a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-medium text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FaTiktok className="w-4 h-4" />
                <span>{tiktokUsername}</span>
                {variant === 'featured' && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-white/20 rounded-full">
                    Fastest Reply
                  </span>
                )}
              </motion.a>

              {/* Featured variant extra message */}
              {variant === 'featured' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4 text-sm text-gray-600 dark:text-gray-400 italic"
                >
                  &quot;Don&apos;t hesitate - happy to help 😊&quot;
                </motion.p>
              )}
            </div>
          </div>
        </div>

        {/* Decorative floating elements */}
        <div className="absolute top-2 right-2 w-20 h-20 bg-purple-400/10 rounded-full blur-2xl animate-float" />
        <div className="absolute bottom-2 left-2 w-16 h-16 bg-pink-400/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '1s' }} />
      </div>
    </motion.div>
  );
}

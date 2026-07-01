'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { FaTiktok } from 'react-icons/fa6';
import { ByteDance } from '@lobehub/icons';

interface FounderCardProps {
  variant?: 'compact' | 'hero' | 'featured';
  showGreeting?: boolean;
  className?: string;
}

const SITE_ASSET_BASE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets';

export default function FounderCard({
  variant = 'compact',
  showGreeting = true,
  className = ''
}: FounderCardProps) {
  const founderImageUrl = `${SITE_ASSET_BASE_URL}/showcase/other/founder.png`;
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
        className={`inline-flex items-center gap-2 ${className}`}
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
          <a
            href="#pricing"
            className="text-[#37352f] font-medium hover:underline"
          >
            Book a demo
          </a>

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

        <motion.div
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#fafafa] border border-[#e9e9e7] rounded-full text-sm"
          animate={{
            borderColor: ['#e9e9e7', '#bdbdb8', '#e9e9e7'],
            boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 4px 14px rgba(0,0,0,0.08)', '0 0 0 rgba(0,0,0,0)']
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <motion.span
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex"
          >
            <ByteDance className="w-3.5 h-3.5 text-[#37352f]" />
          </motion.span>
          <span className="text-xs font-semibold text-[#37352f]">Seedance series supported</span>
        </motion.div>
      </motion.div>
    );
  }

    // Featured variant - for support page - Redesigned Minimalist (Horizontal)
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`group relative ${className}`}
      >
        <div className="relative overflow-hidden rounded-xl bg-[#F7F7F7] border border-[#E5E5E5] p-8 transition-all duration-300">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
            
            {/* Avatar - Left Side */}
            <motion.div
              className="relative flex-shrink-0"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <div className="relative rounded-full overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
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
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#F7F7F7]" />
            </motion.div>

            {/* Content - Right Side */}
            <div className="flex-1 min-w-0">
              {/* Greeting */}
              {showGreeting && (
                <div className="mb-6 space-y-2">
                  <h3 className="text-2xl md:text-3xl font-semibold text-black tracking-tight">
                    {showFullGreeting ? 'Got questions?' : 'Hi there!'}
                  </h3>
                  <p className="text-[#666666] text-base leading-relaxed max-w-xl">
                    {showFullGreeting ? 'Reach out directly. I usually reply within 24 hours.' : 'I\'m here to help.'}
                  </p>
                </div>
              )}

              {/* Action Area */}
              <div className="flex flex-col md:flex-row items-center md:items-center gap-4">
                {/* TikTok link - Primary Button Style */}
                <motion.a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-black text-white font-medium text-sm transition-transform hover:-translate-y-0.5 w-full md:w-auto min-w-[200px]"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <FaTiktok className="w-4 h-4" />
                  <span>DM Founder on TikTok</span>
                </motion.a>

                {/* Featured variant extra message */}
                {variant === 'featured' && (
                  <span className="text-xs font-medium text-[#666666] uppercase tracking-wide">
                    Fastest Response Channel
                  </span>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </motion.div>
    );
}

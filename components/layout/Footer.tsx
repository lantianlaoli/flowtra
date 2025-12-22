import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-[#E5E5E5] py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-12">
          {/* Logo, Description, and Copyright */}
          <section aria-labelledby="footer-about">
            <h2 id="footer-about" className="sr-only">About Flowtra</h2>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/flowtra-logo.png"
                alt="Flowtra Logo"
                width={32}
                height={32}
                className="invert"
              />
              <span className="text-xl font-bold text-black tracking-tight">Flowtra</span>
            </Link>
            <p className="text-[14px] text-[#666666] mb-8 max-w-xs leading-relaxed">
              AI ads for Shopify, dropshipping, content creator, and local stores.
            </p>
            <p className="text-[12px] text-[#666666] uppercase tracking-wider">
              &copy; 2025 Flowtra. All rights reserved.
            </p>
          </section>

          {/* Features Column */}
          <nav aria-labelledby="footer-features">
            <h3 id="footer-features" className="text-[14px] font-bold text-black mb-6 uppercase tracking-wider">Features</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/features/avatar-ads" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Avatar Ads
                </Link>
              </li>
              <li>
                <Link href="/features/competitor-replica" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Competitor Replica
                </Link>
              </li>
            </ul>
          </nav>

          {/* Resources Column */}
          <nav aria-labelledby="footer-resources">
            <h3 id="footer-resources" className="text-[14px] font-bold text-black mb-6 uppercase tracking-wider">Resources</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/blog" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact Column */}
          <nav aria-labelledby="footer-contact">
            <h3 id="footer-contact" className="text-[14px] font-bold text-black mb-6 uppercase tracking-wider">Contact</h3>
            <ul className="space-y-4">
              {[
                { label: 'Email', href: `mailto:${process.env.NEXT_PUBLIC_EMAIL}` },
                { label: 'X', href: process.env.NEXT_PUBLIC_X },
                { label: 'LinkedIn', href: process.env.NEXT_PUBLIC_LINKEDIN?.startsWith('http') ? process.env.NEXT_PUBLIC_LINKEDIN : `https://${process.env.NEXT_PUBLIC_LINKEDIN}` },
                { label: 'TikTok', href: process.env.NEXT_PUBLIC_TIKTOK },
                { label: 'Threads', href: process.env.NEXT_PUBLIC_THREADS },
                { label: 'Instagram', href: process.env.NEXT_PUBLIC_INSTAGRAM },
                { label: 'YouTube', href: process.env.NEXT_PUBLIC_YOUTUBE },
                { label: 'Discord', href: process.env.NEXT_PUBLIC_DISCORD }
              ].filter(link => link.href).map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-[14px] text-[#666666] hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal Column */}
          <nav aria-labelledby="footer-legal">
            <h3 id="footer-legal" className="text-[14px] font-bold text-black mb-6 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/terms" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import Image from 'next/image';
import { getSocialMediaLinks } from '@/lib/social-links';

export default function Footer() {
  const socialLinks = getSocialMediaLinks();

  return (
    <footer className="bg-white border-t border-[#E5E5E5] py-14 md:py-20">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-10 md:gap-12">
          {/* Logo, Description, and Copyright */}
          <section aria-labelledby="footer-about">
            <h2 id="footer-about" className="sr-only">About Flowtra</h2>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.svg"
                alt="Flowtra Logo"
                width={95}
                height={95}
                className="logo-theme w-[86px] h-[86px] sm:w-[95px] sm:h-[95px]"
              />
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
            <h3 id="footer-features" className="text-[13px] font-bold text-black mb-5 uppercase tracking-wider">Features</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/features/avatar-ads" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Avatar Ads
                </Link>
              </li>
              <li>
                <Link href="/features/viral-clone" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Viral Clone
                </Link>
              </li>
              <li>
                <Link href="/features/motion-swap" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Motion Swap
                </Link>
              </li>
            </ul>
          </nav>

          {/* Resources Column */}
          <nav aria-labelledby="footer-resources">
            <h3 id="footer-resources" className="text-[13px] font-bold text-black mb-5 uppercase tracking-wider">Resources</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/blog" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </nav>

          {/* Tools Column */}
          <nav aria-labelledby="footer-tools">
            <h3 id="footer-tools" className="text-[13px] font-bold text-black mb-5 uppercase tracking-wider">Tools</h3>
            <ul className="space-y-4">
              <li>
                <Link href="/tools/upload-assets" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  Upload Assets to URL
                </Link>
              </li>
              <li>
                <Link href="/tools/roas-calculator" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  ROAS Calculator
                </Link>
              </li>
              <li>
                <Link href="/tools/ai-angle-generator" className="text-[14px] text-[#666666] hover:text-black transition-colors">
                  AI Multi-Angle Photo
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact Column */}
          <nav aria-labelledby="footer-contact">
            <h3 id="footer-contact" className="text-[13px] font-bold text-black mb-5 uppercase tracking-wider">Contact</h3>
            <ul className="space-y-4">
              {socialLinks.map((link) => (
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
            <h3 id="footer-legal" className="text-[13px] font-bold text-black mb-5 uppercase tracking-wider">Legal</h3>
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

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-[#1e1e1e] border-t border-[#2d2d2d]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-8 lg:gap-12">
          {/* Logo, Description, and Copyright */}
          <section aria-labelledby="footer-about">
            <h2 id="footer-about" className="sr-only">About Flowtra</h2>
            <Link href={process.env.NEXT_PUBLIC_SITE_URL || "/"} className="flex items-center gap-2 mb-4">
              <Image
                src="/android-chrome-512x512.png"
                alt="Flowtra Logo"
                width={32}
                height={32}
                className=""
              />
              <span className="text-xl font-semibold text-white">Flowtra <span className="italic">AI</span></span>
            </Link>
            <p className="text-sm text-[#a0a0a0] mb-6 max-w-xs leading-relaxed">
              AI ads for Etsy, Shopify, Gumroad, Stan, social platforms, and local stores.
            </p>
            <p className="text-xs text-[#787878]">
              Copyright &copy; 2025 - All rights reserved.
            </p>
          </section>

          {/* Features Column */}
          <nav aria-labelledby="footer-features">
            <h3 id="footer-features" className="text-sm font-semibold text-white mb-4">Features</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/features/standard-ads" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Standard Ads
                </Link>
              </li>
              <li>
                <Link href="/features/multi-variant-ads" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Multi-Variant Ads
                </Link>
              </li>
              <li>
                <Link href="/features/character-ads" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Character Ads
                </Link>
              </li>
            </ul>
          </nav>

          {/* Resources Column */}
          <nav aria-labelledby="footer-resources">
            <h3 id="footer-resources" className="text-sm font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/blog" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/sora2-watermark-removal" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Sora2 Watermark Removal
                </Link>
              </li>
            </ul>
          </nav>

          {/* Company Column */}
          <nav aria-labelledby="footer-company">
            <h3 id="footer-company" className="text-sm font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2.5">
              <li>
                <a
                  href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`}
                  className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
                >
                  Get in touch
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_X || "https://x.com/lantianlaoli"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
                >
                  Follow on X
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : "https://www.linkedin.com/in/laoli-lantian-5ab8632bb"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_TIKTOK || "https://www.tiktok.com/@laolilantian"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
                >
                  TikTok
                </a>
              </li>
              <li>
                <a
                  href={process.env.NEXT_PUBLIC_THREADS || "https://www.threads.com/@lantianlaoli"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#a0a0a0] hover:text-white transition-colors"
                >
                  Threads
                </a>
              </li>
            </ul>
          </nav>

          {/* Legal Column */}
          <nav aria-labelledby="footer-legal">
            <h3 id="footer-legal" className="text-sm font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-2.5">
              <li>
                <Link href="/terms" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-[#a0a0a0] hover:text-white transition-colors">
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
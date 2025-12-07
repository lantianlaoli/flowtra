import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-transparent py-4">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-700 bg-black px-8 py-12 shadow-lg shadow-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-8 lg:gap-12">
            {/* Logo, Description, and Copyright */}
            <section aria-labelledby="footer-about">
              <h2 id="footer-about" className="sr-only">About Flowtra</h2>
              <Link href={process.env.NEXT_PUBLIC_SITE_URL || "/"} className="flex items-center gap-2 mb-4">
                <Image
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/flowtra-logo.png"
                  alt="Flowtra Logo"
                  width={40}
                  height={40}
                  className=""
                />
                <span className="text-xl font-semibold text-white">Flowtra <span className="italic">AI</span></span>
              </Link>
                          <p className="text-sm text-gray-300 mb-6 max-w-xs leading-relaxed">
                            AI ads for Shopify, dropshipping, content creator, and local stores.
                          </p>              <p className="text-xs text-gray-400">
                Copyright &copy; 2025 - All rights reserved.
              </p>
            </section>

            {/* Features Column */}
            <nav aria-labelledby="footer-features">
              <h3 id="footer-features" className="text-sm font-semibold text-white mb-4">Features</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/features/character-ads" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Character Ads
                  </Link>
                </li>
                <li>
                  <Link href="/features/competitor-replica" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Competitor Replica
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Resources Column */}
            <nav aria-labelledby="footer-resources">
              <h3 id="footer-resources" className="text-sm font-semibold text-white mb-4">Resources</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/blog" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/sora2-watermark-removal" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Sora2 Watermark Removal
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Contact Column */}
            <nav aria-labelledby="footer-contact">
              <h3 id="footer-contact" className="text-sm font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`}
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Email
                  </a>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_X || "https://x.com/lantianlaoli"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    X
                  </a>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : "https://www.linkedin.com/in/laoli-lantian-5ab8632bb"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_TIKTOK || "https://www.tiktok.com/@laolilantian"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    TikTok
                  </a>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_THREADS || "https://www.threads.com/@lantianlaoli"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Threads
                  </a>
                </li>
                <li>
                  <a
                    href={process.env.NEXT_PUBLIC_INSTAGRAM || "https://instagram.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://discord.gg/dd5Qh54S"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Discord
                  </a>
                </li>
              </ul>
            </nav>

            {/* Legal Column */}
            <nav aria-labelledby="footer-legal">
              <h3 id="footer-legal" className="text-sm font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/terms" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Terms of Use
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-gray-300 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

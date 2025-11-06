import Link from 'next/link';
import Image from 'next/image';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads } from 'react-icons/fa6';
import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <section className="col-span-1 md:col-span-2" aria-labelledby="footer-about">
            <h2 id="footer-about" className="sr-only">About Flowtra</h2>
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Image
                src="/android-chrome-512x512.png"
                alt="Flowtra Logo"
                width={32}
                height={32}
                className=""
              />
              <span className="text-xl font-semibold text-gray-900">Flowtra</span>
            </Link>
            <p className="text-gray-600 mb-4 max-w-md">
              AI transforms your product photos into professional video ads.
            </p>
          </section>

          {/* Features Links */}
          <nav aria-labelledby="footer-features">
            <h3 id="footer-features" className="font-semibold text-gray-900 mb-4">Features</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features/standard-ads" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Standard Ads
                </Link>
              </li>
              <li>
                <Link href="/features/multi-variant-ads" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Multi-Variant Ads
                </Link>
              </li>
              <li>
                <Link href="/features/character-ads" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Character Ads
                </Link>
              </li>
            </ul>
          </nav>

          {/* Support & Legal Links */}
          <nav className="md:text-right" aria-labelledby="footer-support">
            <h3 id="footer-support" className="font-semibold text-gray-900 mb-4">Support</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-200 mt-12 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-gray-500 text-sm mb-4 md:mb-0">
              &copy; 2025 Flowtra. All rights reserved.
            </p>

            {/* Social Links */}
            <nav className="flex items-center gap-4" aria-label="Social media links">
              {/* Email */}
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Send Email"
              >
                <Mail className="w-5 h-5" />
              </a>

              {/* X (Twitter) */}
              <a
                href={process.env.NEXT_PUBLIC_X || "https://x.com/lantianlaoli"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Follow on X"
              >
                <FaXTwitter className="w-5 h-5" />
              </a>

              {/* LinkedIn */}
              <a
                href={process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : "https://www.linkedin.com/in/laoli-lantian-5ab8632bb"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Connect on LinkedIn"
              >
                <FaLinkedin className="w-5 h-5" />
              </a>

              {/* TikTok */}
              <a
                href={process.env.NEXT_PUBLIC_TIKTOK || "https://www.tiktok.com/@laolilantian"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Follow on TikTok"
              >
                <FaTiktok className="w-5 h-5" />
              </a>

              {/* Threads */}
              <a
                href={process.env.NEXT_PUBLIC_THREADS || "https://www.threads.com/@lantianlaoli"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Follow on Threads"
              >
                <FaThreads className="w-5 h-5" />
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
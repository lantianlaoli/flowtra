'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  showAuthButtons?: boolean;
}

export default function Header({ showAuthButtons = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      setCompact(y > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <div
        className={`mx-auto transition-[max-width] duration-300 ease-out ${
          compact ? 'max-w-4xl' : 'max-w-7xl'
        } px-4 sm:px-6 lg:px-8`}
      >
        <div
          className={`flex items-center justify-between h-16 transition-all duration-300 ${
            compact
              ? 'rounded-lg border border-white/40 bg-white/60 backdrop-blur-md backdrop-saturate-150 ring-1 ring-black/5 px-4 shadow'
              : 'border-b border-gray-200 bg-white px-0'
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/logo.png" 
              alt="Flowtra AI Logo" 
              width={32} 
              height={32} 
              className=""
            />
            <span className="text-[1.35rem] leading-none font-semibold font-serif tracking-wide text-gray-900">
              Flowtra <span className="font-serif italic">AI</span>
            </span>
          </Link>

          {/* Auth Buttons */}
          {showAuthButtons && (
            <div className="hidden md:flex items-center gap-6">
              <Link 
                href="/#features" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                Features
              </Link>
              <Link 
                href="/#pricing" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                Pricing
              </Link>
              <Link 
                href="/#blog" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                Blog
              </Link>
              <Link
                href="/#faq"
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                FAQ
              </Link>
              <Link
                href="/sora2-watermark-removal"
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-md hover:bg-gray-50"
              >
                Sora2 Watermark Removal
              </Link>
              <SignedOut>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                    Login
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link 
                  href="/dashboard" 
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile menu with animation */}
        <div
          id="mobile-nav"
          className={`md:hidden overflow-hidden border-t border-gray-200 transition-all duration-300 ease-out ${
            mobileMenuOpen ? 'opacity-100 max-h-[420px] py-4' : 'opacity-0 max-h-0 py-0'
          }`}
          aria-hidden={!mobileMenuOpen}
        >
            <nav className="flex flex-col gap-5">
              <Link 
                href="/#features" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="/#pricing" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/#blog" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                href="/#faq"
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <Link
                href="/sora2-watermark-removal"
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sora2 Watermark Removal
              </Link>

              {showAuthButtons && (
                <div className="pt-4 border-t border-gray-200">
                  <SignedOut>
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                      <button
                        className="block border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-center font-semibold w-full"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Login
                      </button>
                    </SignInButton>
                  </SignedOut>
                  <SignedIn>
                    <Link
                      href="/dashboard"
                      className="block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-center font-semibold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  </SignedIn>
                </div>
              )}
            </nav>
        </div>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  showAuthButtons?: boolean;
}

export default function Header({ showAuthButtons = true }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/android-chrome-512x512.png" 
              alt="Flowtra Logo" 
              width={32} 
              height={32} 
              className=""
            />
            <span className="text-xl font-semibold text-gray-900">Flowtra</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              href="/features" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Features
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/library" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Library
            </Link>
            <Link 
              href="/contact" 
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Contact
            </Link>
          </nav>

          {/* Auth Buttons */}
          {showAuthButtons && (
            <div className="hidden md:flex items-center gap-4">
              <SignedOut>
                <Link 
                  href="/sign-in" 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign in
                </Link>
                <Link 
                  href="/sign-up" 
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Join for free
                </Link>
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
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col gap-4">
              <Link 
                href="/features" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="/pricing" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/library" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Library
              </Link>
              <Link 
                href="/contact" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              
              {showAuthButtons && (
                <div className="pt-4 border-t border-gray-200">
                  <SignedOut>
                    <Link 
                      href="/sign-in" 
                      className="block text-gray-600 hover:text-gray-900 transition-colors mb-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link 
                      href="/sign-up" 
                      className="block bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-center font-semibold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Join for free
                    </Link>
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
        )}
      </div>
    </header>
  );
}
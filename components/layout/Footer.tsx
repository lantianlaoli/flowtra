'use client';

import Link from 'next/link';
import Image from 'next/image';
import { getSocialMediaLinks } from '@/lib/social-links';
import { useI18n } from '@/providers/I18nProvider';
import { trackLandingToolClick } from '@/lib/analytics/landing-tools';

export default function Footer() {
  const { messages } = useI18n();
  const footerMessages = messages.landing.footer;
  const socialLinks = getSocialMediaLinks();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="landing-section-surface bg-white px-4 pb-8 pt-12 sm:px-6 md:pb-10 md:pt-16 lg:px-8 lg:pt-18">
      <div className="mx-auto max-w-[1280px]">
        <div className="landing-footer-shell rounded-[32px] border border-[#E5E5E5] bg-[#FAFAFA] px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.06)] sm:px-6 sm:py-7 lg:px-7 lg:py-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.45fr_repeat(6,minmax(0,0.92fr))]">
            <section
              aria-labelledby="footer-about"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h2 id="footer-about" className="sr-only">{footerMessages.aboutTitle}</h2>
              <Link href="/" className="mb-3 flex items-center gap-2">
                <Image
                  src="/logo.svg"
                  alt="Flowtra Logo"
                  width={95}
                  height={95}
                  className="logo-theme h-[58px] w-[58px] sm:h-[64px] sm:w-[64px]"
                />
              </Link>
              <p className="mb-3 max-w-[240px] text-[13px] leading-[1.55] text-[#666666]">
                {footerMessages.description}
              </p>
              <p className="mb-3 text-[13px] leading-[1.55] text-[#666666]">
                {footerMessages.disclaimer}
              </p>
              <p className="text-[13px] leading-[1.55] text-[#666666]">
                {footerMessages.transparency}
              </p>
              <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-[#666666]">
                &copy; {currentYear} Flowtra. {footerMessages.rightsReserved}
              </p>
            </section>

            <nav
              aria-labelledby="footer-features"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-features" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.features}</h3>
              <ul className="space-y-3">
              {footerMessages.featureItems.map((feature) => (
                <li key={feature.href}>
                  <Link
                    href={feature.href}
                    className={`group inline-flex items-center gap-2 text-[13px] leading-5 transition-colors ${
                      feature.isNew
                        ? 'font-semibold text-black'
                        : 'text-[#666666] hover:text-black'
                    }`}
                  >
                    <span>{feature.label}</span>
                    {feature.isNew ? (
                      <span className="inline-flex items-center rounded-full border border-black bg-black px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white transition-transform duration-200 group-hover:-translate-y-0.5">
                        {footerMessages.newBadge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-resources"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-resources" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.resources}</h3>
              <ul className="space-y-3">
              <li>
                <Link href="/blog" className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black">
                  {footerMessages.blog}
                </Link>
              </li>
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-tools"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-tools" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.tools}</h3>
              <ul className="space-y-3">
              {footerMessages.toolItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black"
                    onClick={() => trackLandingToolClick(item.href, 'landing_footer_tools')}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-social-proof"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-social-proof" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.socialProof}</h3>
              <ul className="space-y-3">
              <li>
                <a
                  href="https://aidirs.org/item/flowtra"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black"
                >
                  AIDirs
                </a>
              </li>
              <li>
                <a
                  href="https://turbo0.com/item/flowtra"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <Image
                    src="https://img.turbo0.com/badge-listed-light.svg"
                    alt="Listed on Turbo0"
                    width={132}
                    height={42}
                    unoptimized
                    className="h-[42px] w-auto"
                  />
                </a>
              </li>
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-contact"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-contact" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.contact}</h3>
              <ul className="space-y-3">
              {socialLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black" target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-legal"
              className="landing-footer-card rounded-[26px] border border-[#E5E5E5] bg-white p-5"
            >
              <h3 id="footer-legal" className="mb-3 text-[13px] font-bold uppercase tracking-wider text-black">{footerMessages.legal}</h3>
              <ul className="space-y-3">
              <li>
                <Link href="/terms" className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black">
                  {footerMessages.terms}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[13px] leading-5 text-[#666666] transition-colors hover:text-black">
                  {footerMessages.privacy}
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

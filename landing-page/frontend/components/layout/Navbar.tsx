'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const navLinks = [
  { label: 'Products', href: '/#products' },
  { label: 'Thesis', href: '/thesis' },
  { label: 'Insights', href: '/insights' },
];

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="3" y="4" width="7" height="16" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="12" y="8" width="6" height="12" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="17" y="12" width="4" height="8" rx="1.5" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // On homepage, the hero is dark, so we need light nav text when not scrolled
  const isHomepage = pathname === '/';
  const isDarkHero = isHomepage && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleHashClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const hash = href.split('#')[1];
      if (!hash || pathname !== '/') return;
      const el = document.getElementById(hash);
      if (el) {
        e.preventDefault();
        setMobileOpen(false);
        el.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [pathname],
  );

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const textColor = isDarkHero ? 'text-white' : 'text-primary-dark';
  const textMuted = isDarkHero ? 'text-white/70 hover:text-white' : 'text-slate hover:text-primary-dark';
  const logoColor = isDarkHero ? 'text-white' : 'text-primary';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-sticky transition-all duration-250 ease-stripe ${
        scrolled
          ? 'bg-white/80 backdrop-blur-lg border-b border-border/50 shadow-stripe-nav'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="container-wide flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <LogoMark className={`w-6 h-6 ${logoColor} transition-colors duration-250 ease-stripe`} />
          <span className={`text-subheading ${textColor} transition-colors duration-250 ease-stripe`}>
            Lynia
          </span>
        </Link>

        {/* Desktop links — centered */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => {
            const isHash = link.href.includes('#');
            const isActive = isHash
              ? false
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.label}
                href={link.href}
                onClick={isHash ? (e: React.MouseEvent<HTMLAnchorElement>) => handleHashClick(e, link.href) : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`relative text-body font-medium transition-colors duration-250 ease-stripe pb-1 ${
                  isActive
                    ? `${textColor} after:scale-x-100`
                    : `${textMuted} after:scale-x-0 hover:after:scale-x-100`
                } after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full after:origin-left after:transition-transform after:duration-250 after:ease-stripe-out ${
                  isDarkHero ? 'after:bg-white/70' : 'after:bg-primary'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:block">
          <Button
            variant={isDarkHero ? 'ghost' : 'primary'}
            size="sm"
            href="/contact"
          >
            Talk to our team &rarr;
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className={`lg:hidden p-2 rounded-md transition-colors duration-250 ease-stripe ${
            isDarkHero ? 'hover:bg-white/10' : 'hover:bg-gray-100'
          }`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <X className={`w-6 h-6 ${textColor} transition-colors duration-250`} />
          ) : (
            <Menu className={`w-6 h-6 ${textColor} transition-colors duration-250`} />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-border animate-fade-down">
          <div className="px-6 py-6 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isHash = link.href.includes('#');
              const isActive = isHash
                ? false
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={isHash ? (e: React.MouseEvent<HTMLAnchorElement>) => handleHashClick(e, link.href) : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`text-subheading py-3 transition-colors duration-250 ease-stripe ${
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-primary-dark hover:text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-4">
              <Button variant="primary" size="sm" href="/contact" className="w-full">
                Talk to our team &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

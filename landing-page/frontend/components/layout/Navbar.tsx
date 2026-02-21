'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const navLinks = [
  { label: 'Products', href: '/products' },
  { label: 'Thesis', href: '/thesis' },
  { label: 'Press', href: '/press' },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
        <Link href="/" className="flex items-center gap-2">
          <span className="text-subheading text-primary-dark transition-colors duration-250 ease-stripe">
            Lynia
          </span>
        </Link>

        {/* Desktop links — centered */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`text-body-sm font-medium transition-colors duration-250 ease-stripe ${
                  isActive
                    ? 'text-primary-dark border-b-2 border-primary pb-0.5'
                    : 'text-slate hover:text-primary-dark'
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
            variant="primary"
            size="sm"
            href="/#get-started"
          >
            Get started &rarr;
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 rounded-md transition-colors duration-250 ease-stripe hover:bg-white/10"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <X className="w-6 h-6 text-primary-dark" />
          ) : (
            <Menu className="w-6 h-6 text-primary-dark" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-border animate-fade-down">
          <div className="px-6 py-6 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.label}
                  href={link.href}
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
              <Button variant="primary" size="lg" href="/#get-started" className="w-full">
                Get started &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

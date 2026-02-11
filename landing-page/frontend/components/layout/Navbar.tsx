'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const navLinks = [
  { label: 'Products', href: '/#products' },
  { label: 'About', href: '/about' },
  { label: 'Partnerships', href: '/#enterprise' },
  { label: 'Editorial', href: '/editorial' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-sticky transition-all duration-200 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="container-wide flex items-center justify-between h-[72px] lg:h-[72px]">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <span
            className={`text-h4 font-medium transition-colors duration-200 ${
              scrolled ? 'text-primary-dark' : 'text-white'
            }`}
          >
            Lynia Finance
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`text-body-sm font-medium transition-colors duration-150 ${
                scrolled
                  ? 'text-slate hover:text-primary-dark'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:block">
          <Button
            variant={scrolled ? 'primary' : 'white'}
            size="sm"
            href="/#apply"
          >
            Start your application
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? (
            <X className={`w-6 h-6 ${scrolled ? 'text-primary-dark' : 'text-white'}`} />
          ) : (
            <Menu className={`w-6 h-6 ${scrolled ? 'text-primary-dark' : 'text-white'}`} />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-border animate-fade-in-up">
          <div className="px-6 py-6 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-h4 text-primary-dark py-3 hover:text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4">
              <Button variant="primary" size="lg" href="/#apply" className="w-full">
                Start your application
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

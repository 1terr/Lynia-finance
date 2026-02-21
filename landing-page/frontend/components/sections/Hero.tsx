'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: 'var(--gradient-hero)' }}
    >
      {/* Great Zimbabwe zig-zag stone pattern overlay */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 1440 900">
          <defs>
            <pattern id="zigzag" x="0" y="0" width="60" height="30" patternUnits="userSpaceOnUse">
              <polyline points="0,15 15,0 30,15 45,0 60,15" fill="none" stroke="white" strokeWidth="1.5" />
              <polyline points="0,30 15,15 30,30 45,15 60,30" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#zigzag)" />
        </svg>
      </div>

      <div className="container-main relative z-10">
        <div className="max-w-[720px] pt-20 lg:pt-0">
          <h1
            className="text-display-mobile lg:text-display text-white opacity-0 animate-fade-in-up"
          >
            Financing for the productive majority.
          </h1>
          <p
            className="mt-6 text-body-lg text-white/70 max-w-[600px] opacity-0 animate-fade-in-up"
            style={{ animationDelay: '100ms' }}
          >
            Lynia is the financial infrastructure for Zimbabwe&apos;s $10B informal
            economy. We transform mobile money velocity into credit identities,
            providing the capital necessary for thin-file entrepreneurs to
            transition from survival to growth.
          </p>
          <div
            className="mt-8 flex flex-wrap items-center gap-4 opacity-0 animate-fade-in-up"
            style={{ animationDelay: '200ms' }}
          >
            <Button variant="white" size="lg" href="#get-started">
              Get started
            </Button>
            <Button variant="secondary" href="/thesis" className="text-white hover:text-white/80">
              Read the 2026 Thesis
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

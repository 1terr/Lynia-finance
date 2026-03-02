'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-navy">
      {/* Gradient background layers */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #0A2540 0%, #0D2E4D 30%, #112B45 60%, #0A2540 100%)',
        }}
      />

      {/* Subtle gradient accent overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(99, 91, 255, 0.15), transparent)',
        }}
      />

      {/* Line grid pattern overlay */}
      <div className="absolute inset-0 line-grid opacity-[0.35]" />

      {/* Gradient orbs — hidden on mobile for performance */}
      <div
        className="gradient-orb hidden md:block animate-float"
        style={{
          width: '500px',
          height: '500px',
          top: '-10%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(99, 91, 255, 0.12) 0%, transparent 70%)',
        }}
      />
      <div
        className="gradient-orb hidden md:block animate-float"
        style={{
          width: '400px',
          height: '400px',
          bottom: '5%',
          left: '-5%',
          background: 'radial-gradient(circle, rgba(110, 195, 244, 0.08) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />
      <div
        className="gradient-orb hidden lg:block animate-slow-spin"
        style={{
          width: '300px',
          height: '300px',
          top: '50%',
          right: '15%',
          background: 'radial-gradient(circle, rgba(99, 91, 255, 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="container-main relative z-10">
        <div className="max-w-[680px] md:max-w-[780px] lg:max-w-[900px] pt-24 lg:pt-0">
          {/* Headline */}
          <h1
            className="text-hero-mobile md:text-hero-tablet lg:text-hero opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards', animationDelay: '80ms' }}
          >
            <span className="text-white">
              Financing for the productive majority.
            </span>{' '}
            <span className="text-white/60">
              Credit infrastructure for thin-file entrepreneurs transitioning from survival to growth.
            </span>
          </h1>

          {/* CTAs */}
          <div
            className="mt-16 flex flex-wrap items-center gap-4 opacity-0 animate-fade-up"
            style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
          >
            <Button variant="accent" href="/contact" arrow>
              Talk to our team
            </Button>
            <Button variant="ghost" href="/thesis" arrow>
              Read the 2026 Thesis
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}

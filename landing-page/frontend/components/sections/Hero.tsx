'use client';

import { Button } from '@/components/ui/Button';

const partners = ['EcoCash', 'Innbucks', 'OneWallet', 'OMari'];

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

      {/* Dot grid pattern overlay */}
      <div className="absolute inset-0 dot-grid opacity-[0.04]" />

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
          {/* Badge */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationFillMode: 'forwards' }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-white/70" style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.02em' }}>
                Zimbabwean informal MSMEs: &nbsp;86%
              </span>
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-hero-mobile md:text-hero-tablet lg:text-hero mt-6 opacity-0 animate-fade-up"
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
            className="mt-10 flex flex-wrap items-center gap-4 opacity-0 animate-fade-up"
            style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
          >
            <Button variant="accent" href="/contact" arrow>
              Talk to our team
            </Button>
            <Button variant="ghost" href="/thesis" arrow>
              Read the 2026 Thesis
            </Button>
          </div>

          {/* Social proof strip */}
          <div
            className="mt-16 opacity-0 animate-fade-up"
            style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
          >
            <p className="text-overline uppercase tracking-wider text-white/30 mb-3">
              Integrated with
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {partners.map((name) => (
                <span
                  key={name}
                  className="text-body-sm font-medium text-white/40 transition-colors duration-250 hover:text-white/70"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

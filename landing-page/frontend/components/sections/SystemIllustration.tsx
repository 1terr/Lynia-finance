'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionHeading } from '@/components/ui/SectionHeading';

const mobileMoneyProviders = [
  { name: 'EcoCash', color: '#00A651' },
  { name: 'Innbucks', color: '#FF6B00' },
  { name: 'OneWallet', color: '#0072CE' },
  { name: 'OMari', color: '#8B5CF6' },
];

const apiServices = [
  { name: 'KYC Data' },
  { name: 'Credit Scoring' },
  { name: 'Loan Disbursement' },
  { name: 'Insurance' },
];

const ecosystemPartners = [
  { name: 'Retailers' },
  { name: 'Distributors' },
  { name: 'Employers' },
  { name: 'Platforms' },
];

function AnimatedConnector() {
  return (
    <div className="flex items-center justify-center py-3 lg:py-0">
      {/* Mobile: vertical down arrow with bounce */}
      <div className="flex lg:hidden flex-col items-center gap-1">
        <div className="w-[2px] h-6 bg-gradient-to-b from-white/10 to-primary/30" />
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          className="text-primary/50"
          style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }}
        >
          <path
            d="M1 1L6 6L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Desktop: horizontal flowing SVG connector */}
      <svg
        className="hidden lg:block"
        width="80"
        height="40"
        viewBox="0 0 80 40"
        fill="none"
        aria-hidden="true"
      >
        {/* Base line */}
        <line
          x1="4"
          y1="20"
          x2="72"
          y2="20"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />

        {/* Animated dashed overlay — flowing data effect */}
        <line
          x1="4"
          y1="20"
          x2="72"
          y2="20"
          stroke="rgba(99,91,255,0.35)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          strokeLinecap="round"
          style={{ animation: 'flow-dash 1.5s linear infinite' }}
        />

        {/* Pulsing start dot */}
        <circle cx="4" cy="20" r="3" fill="rgba(99,91,255,0.15)" />
        <circle
          cx="4"
          cy="20"
          r="2"
          fill="rgba(99,91,255,0.5)"
          style={{ animation: 'pulse-dot 3s ease-in-out infinite' }}
        />

        {/* Flowing particle 1 */}
        <circle r="2.5" fill="rgba(99,91,255,0.8)">
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path="M 4 20 L 72 20"
          />
        </circle>

        {/* Flowing particle 2 (staggered) */}
        <circle r="1.5" fill="rgba(110,195,244,0.6)">
          <animateMotion
            dur="2s"
            begin="0.8s"
            repeatCount="indefinite"
            path="M 4 20 L 72 20"
          />
        </circle>

        {/* Arrow tip */}
        <path
          d="M 66 14 L 76 20 L 66 26"
          stroke="rgba(99,91,255,0.5)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function SystemIllustration() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="relative overflow-hidden bg-navy py-16 lg:py-24">
      {/* Dot grid texture */}
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      <div className="container-main relative z-10">
        <SectionHeading
          overline="EMBEDDED LENDING INFRASTRUCTURE"
          title="Connect to existing systems."
          subtitle="Orchestrate lending across mobile money providers, build custom workflows, and connect to ecosystem partners via APIs."
          isVisible={isVisible}
          dark
        />

        {/* System diagram */}
        <div
          className={`mt-10 max-w-[960px] mx-auto fade-in-slow ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-lg'
          }`}
          style={{ transitionDelay: '180ms' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_auto_80px_1fr] gap-0 items-center">
            {/* Left: Ecosystem Partners */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-white/40 mb-2">
                Ecosystem Partners
              </p>
              {ecosystemPartners.map((partner, index) => (
                <div
                  key={partner.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-4 py-3 text-body-sm text-white/80 hover:bg-white/[0.10] transition-colors duration-250 ease-stripe cursor-default"
                  style={{
                    animation: `float-subtle ${5 + index * 0.5}s ease-in-out infinite`,
                    animationDelay: `${index * 0.4}s`,
                  }}
                >
                  {partner.name}
                </div>
              ))}
            </div>

            {/* Left → Center Connector */}
            <AnimatedConnector />

            {/* Center: Lynia Core */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="bg-primary rounded-xl p-6 lg:p-8 text-center min-w-[200px]"
                style={{ animation: 'pulse-glow 4s ease-in-out infinite' }}
              >
                <p className="text-subheading text-white">Lynia</p>
                <p className="text-caption text-white/70 mt-1">Core Engine</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {apiServices.map((service, index) => (
                  <div
                    key={service.name}
                    className="bg-white/[0.08] border border-white/[0.12] rounded-md px-3 py-2 text-caption text-white/80 text-center"
                    style={{
                      animation: `float-subtle ${6 + index * 0.3}s ease-in-out infinite`,
                      animationDelay: `${index * 0.25}s`,
                    }}
                  >
                    {service.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Center → Right Connector */}
            <AnimatedConnector />

            {/* Right: Mobile Money Providers */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-white/40 mb-2">
                Mobile Money
              </p>
              {mobileMoneyProviders.map((provider, index) => (
                <div
                  key={provider.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-white/[0.10] transition-colors duration-250 ease-stripe cursor-default"
                  style={{
                    animation: `float-subtle ${5 + index * 0.5}s ease-in-out infinite`,
                    animationDelay: `${index * 0.4}s`,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: provider.color,
                      animation: 'pulse-dot 3s ease-in-out infinite',
                      animationDelay: `${index * 0.5}s`,
                    }}
                  />
                  <span className="text-body-sm text-white/80">
                    {provider.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

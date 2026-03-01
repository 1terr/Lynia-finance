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
  { name: 'KYC Data', color: '#635BFF' },
  { name: 'Credit Scoring', color: '#635BFF' },
  { name: 'Loan Disbursement', color: '#635BFF' },
  { name: 'Insurance', color: '#635BFF' },
];

const ecosystemPartners = [
  { name: 'Retailers' },
  { name: 'Distributors' },
  { name: 'Employers' },
  { name: 'Platforms' },
];

function ConnectionArrow({ direction }: { direction: 'right' | 'down' }) {
  if (direction === 'down') {
    return (
      <div className="flex lg:hidden flex-col items-center gap-1 py-3">
        <div className="w-[2px] h-6 bg-white/20" />
        <svg
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          className="text-white/30"
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
    );
  }

  return (
    <div className="hidden lg:flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-white/20" />
      <div className="w-10 h-[2px] bg-white/20" />
      <svg
        width="8"
        height="12"
        viewBox="0 0 8 12"
        fill="none"
        className="text-white/30"
      >
        <path
          d="M1 1L6 6L1 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
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
        <div>
          <SectionHeading
            overline="EMBEDDED LENDING INFRASTRUCTURE"
            title="Connect to existing systems."
            subtitle="Orchestrate lending across mobile money providers, build custom workflows, and connect to ecosystem partners via APIs."
            isVisible={isVisible}
            dark
          />
        </div>

        {/* System diagram */}
        <div
          className={`mt-10 max-w-[900px] mx-auto fade-in-slow ${
            isVisible ? 'fade-in-visible' : 'fade-in-hidden-lg'
          }`}
          style={{ transitionDelay: '180ms' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-0 items-center">
            {/* Left: Ecosystem Partners */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-white/40 mb-2">
                Ecosystem Partners
              </p>
              {ecosystemPartners.map((partner) => (
                <div
                  key={partner.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-4 py-3 text-body-sm text-white/80 hover:-translate-y-0.5 hover:bg-white/[0.10] transition-all duration-250 ease-stripe cursor-default"
                >
                  {partner.name}
                </div>
              ))}
            </div>

            {/* Connection: Left → Center */}
            <ConnectionArrow direction="down" />

            {/* Center: Lynia Core */}
            <div className="flex flex-col items-center gap-4 lg:px-6">
              <ConnectionArrow direction="right" />

              <div className="bg-primary rounded-xl p-6 lg:p-8 text-center shadow-stripe-lg min-w-[200px]">
                <p className="text-subheading text-white">Lynia</p>
                <p className="text-caption text-white/70 mt-1">Core Engine</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {apiServices.map((service) => (
                  <div
                    key={service.name}
                    className="bg-white/[0.08] border border-white/[0.12] rounded-md px-3 py-2 text-caption text-white/80 text-center"
                  >
                    {service.name}
                  </div>
                ))}
              </div>

              <ConnectionArrow direction="right" />
            </div>

            {/* Connection: Center → Right */}
            <ConnectionArrow direction="down" />

            {/* Right: Mobile Money Providers */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-white/40 mb-2">
                Mobile Money
              </p>
              {mobileMoneyProviders.map((provider) => (
                <div
                  key={provider.name}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-4 py-3 flex items-center gap-3 hover:-translate-y-0.5 hover:bg-white/[0.10] transition-all duration-250 ease-stripe cursor-default"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: provider.color }}
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

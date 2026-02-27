'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';

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

export function SystemIllustration() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} className="bg-white py-16 lg:py-[120px]">
      <div className="container-main">
        <div>
          <span
            className={`text-overline uppercase tracking-wider text-primary transition-all duration-500 ease-stripe-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            EMBEDDED LENDING INFRASTRUCTURE
          </span>
          <h2
            className={`text-display-mobile md:text-display-tablet lg:text-display text-primary-dark mt-4 transition-all duration-500 ease-stripe-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            Connect to existing systems.
          </h2>
          <p
            className={`text-body-lg text-slate max-w-[640px] mt-6 transition-all duration-500 ease-stripe-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            Orchestrate lending across mobile money providers, build custom
            workflows, and connect to ecosystem partners via APIs.
          </p>
        </div>

        {/* System diagram */}
        <div
          className={`mt-12 max-w-[900px] mx-auto transition-all duration-700 ease-stripe-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: '180ms' }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-0 items-center">
            {/* Left: Ecosystem Partners */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-slate-light mb-2">
                Ecosystem Partners
              </p>
              {ecosystemPartners.map((partner) => (
                <div
                  key={partner.name}
                  className="bg-surface-secondary border border-border rounded-lg px-4 py-3 text-body-sm text-slate"
                >
                  {partner.name}
                </div>
              ))}
            </div>

            {/* Center: Lynia Core */}
            <div className="flex flex-col items-center gap-4 lg:px-8">
              {/* Connection lines (visual) */}
              <div className="hidden lg:flex items-center gap-2 text-border">
                <div className="w-8 h-[2px] bg-border" />
                <span className="text-caption">&rarr;</span>
              </div>

              <div className="bg-primary rounded-xl p-6 lg:p-8 text-center shadow-stripe-lg min-w-[200px]">
                <p className="text-subheading text-white">Lynia</p>
                <p className="text-caption text-white/70 mt-1">Core Engine</p>
              </div>

              {/* API Services */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {apiServices.map((service) => (
                  <div
                    key={service.name}
                    className="bg-primary/10 border border-primary/20 rounded-md px-3 py-2 text-caption text-primary-dark text-center"
                  >
                    {service.name}
                  </div>
                ))}
              </div>

              <div className="hidden lg:flex items-center gap-2 text-border">
                <span className="text-caption">&rarr;</span>
                <div className="w-8 h-[2px] bg-border" />
              </div>
            </div>

            {/* Right: Mobile Money Providers */}
            <div className="flex flex-col gap-3">
              <p className="text-caption uppercase tracking-wider text-slate-light mb-2">
                Mobile Money
              </p>
              {mobileMoneyProviders.map((provider) => (
                <div
                  key={provider.name}
                  className="bg-surface-secondary border border-border rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: provider.color }}
                  />
                  <span className="text-body-sm text-slate">
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
'use client';

import { useScrollAnimation } from '@/lib/useScrollAnimation';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { MessageSquare, Link2, Smartphone } from 'lucide-react';

const providers = [
  { name: 'Innbucks', color: '#FF6B00' },
  { name: 'EcoCash', color: '#00A651' },
  { name: 'OneWallet', color: '#0072CE' },
  { name: 'OMari', color: '#8B5CF6' },
];

export function ProductBento() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section ref={ref} id="products" className="bg-white py-16 lg:py-24">
      <div className="container-main">
        <SectionHeading
          overline="OUR PRODUCTS"
          title="Three products, one mission."
          isVisible={isVisible}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
          {/* Digital Credit — Top Left */}
          <div
            className={`border border-border border-t-4 border-t-primary rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md hover:bg-primary-50/50 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="text-overline uppercase tracking-wider text-primary">
              DIGITAL CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-3">
              Conversational Liquidity
            </h3>
            <p className="text-body text-slate mt-3">
              Instant, collateral-free credit for civil servants and partner
              employees.
            </p>
            <p className="text-body-sm text-slate mt-4">
              WhatsApp-native applications with instant disbursement to:
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {providers.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-secondary text-body-sm font-medium text-primary-dark"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>

          {/* Embedded Credit — Top Right */}
          <div
            className={`border border-border border-t-4 border-t-info rounded-xl p-8 shadow-stripe-sm transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-md hover:bg-primary-50/50 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '60ms' }}
          >
            <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-4">
              <Link2 className="w-5 h-5 text-info" />
            </div>
            <span className="text-overline uppercase tracking-wider text-info">
              EMBEDDED CREDIT
            </span>
            <h3 className="text-heading-mobile lg:text-heading text-primary-dark mt-3">
              API for Ecosystem Resilience
            </h3>
            <p className="text-body text-slate mt-3">
              Connect via API or data sharing to finance your platform&apos;s
              ecosystem. We analyze mobile money activity to provide credit
              bundled with health/life insurance and capacity-building
              mechanisms.
            </p>
          </div>

          {/* Asset-Backed Credit — Full Width Bottom (Dark Treatment) */}
          <div
            className={`rounded-xl p-8 lg:p-10 shadow-stripe-md transition-all duration-300 ease-stripe-out hover:-translate-y-1 hover:shadow-stripe-lg lg:col-span-2 flex flex-col justify-between bg-navy relative overflow-hidden ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ transitionDelay: '120ms' }}
          >
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 line-grid opacity-50" />

            <div className="relative z-10">
              <div className="w-10 h-10 rounded-lg bg-success/15 flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5 text-success" />
              </div>
              <span className="text-overline uppercase tracking-wider text-success">
                ASSET-BACKED CREDIT
              </span>
              <h3 className="text-heading-mobile lg:text-heading text-white mt-3">
                Productive Asset Financing
              </h3>
              <p className="text-body text-white/70 mt-3 max-w-[640px]">
                We finance the income-generating tools of the informal
                sector&mdash;starting with smartphones and scaling to gig-economy
                assets.
              </p>
              <div className="mt-6 p-4 bg-white/[0.06] border border-white/10 rounded-lg">
                <p className="text-body-sm font-medium text-white">
                  IoT-based risk management
                </p>
                <p className="text-body-sm text-white/60 mt-2">
                  We substitute traditional collateral with real-time asset
                  telemetry. By monitoring usage and health, we enable credit for
                  those the formal system deems &ldquo;unbankable.&rdquo;
                </p>
              </div>
            </div>
            <p className="relative z-10 text-caption text-white/40 mt-6">
              CGAP Alignment: Shifting from &ldquo;negative collateral&rdquo; to
              &ldquo;productive trust&rdquo; by funding assets that grow cash
              flow.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
